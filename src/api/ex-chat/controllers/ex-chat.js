'use strict';

/**
 * ex-chat controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { getIO } = require('../../../socket');

const isNumericId = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const str = String(value);
  return str.trim() !== '' && !Number.isNaN(Number(str));
};

const resolveChatIdParamToDocumentId = async (strapi, idParam) => {
  if (!idParam) return null;
  if (!isNumericId(idParam)) return idParam;

  const entity = await strapi.db.query('api::ex-chat.ex-chat').findOne({
    where: { id: Number(idParam) },
    select: ['documentId'],
  });

  return entity ? entity.documentId : null;
};

const parseActorRef = (value) => {
  if (!value) return null;

  // Accept { type: 'user'|'agent', id } or { kind, id }
  if (typeof value === 'object') {
    const type = value.type || value.kind;
    const id = value.id || value.documentId;
    if (type && id !== undefined && id !== null) {
      return { type: String(type), id };
    }
  }

  // Accept string "user:123" / "agent:2"
  if (typeof value === 'string' && value.includes(':')) {
    const [type, id] = value.split(':');
    if (type && id) return { type, id };
  }

  // Bare numbers => user id
  if (typeof value === 'number') return { type: 'user', id: value };

  return null;
};

module.exports = createCoreController('api::ex-chat.ex-chat', ({ strapi }) => ({
  async find(ctx) {
    // Some clients use populate[assignee]=* which may cause Strapi query validation errors
    // due to nested populates on users-permissions user (e.g. role).
    // Normalize to a safe user populate shape.
    const populate = ctx && ctx.query && ctx.query.populate;
    if (populate && typeof populate === 'object') {
      const normalizeUserPopulate = (value) => {
        if (!value) return value;
        if (value === '*') {
          return { fields: ['id', 'username', 'email'] };
        }
        if (typeof value === 'object') {
          const next = { ...value };
          // Disallow nested role populate which commonly triggers "Invalid key role" validation
          if (next.populate && typeof next.populate === 'object' && Object.prototype.hasOwnProperty.call(next.populate, 'role')) {
            const { role: _ignored, ...rest } = next.populate;
            next.populate = rest;
          }
          return next;
        }
        return value;
      };

      const normalizeAgentPopulate = (value) => {
        if (!value) return value;
        if (value === '*') {
          return { fields: ['id', 'documentId', 'name', 'modelProvider', 'modelName'] };
        }
        return value;
      };

      if (Object.prototype.hasOwnProperty.call(populate, 'assignee')) {
        populate.assignee = normalizeUserPopulate(populate.assignee);
      }
      if (Object.prototype.hasOwnProperty.call(populate, 'assigneeAgent')) {
        populate.assigneeAgent = normalizeAgentPopulate(populate.assigneeAgent);
      }
      if (Object.prototype.hasOwnProperty.call(populate, 'assignedBy')) {
        populate.assignedBy = normalizeUserPopulate(populate.assignedBy);
      }

      // Labels: prevent wildcard populate from trying to populate inverse `chats` relation
      const normalizeLabelsPopulate = (value) => {
        if (!value) return value;
        if (value === '*') {
          return { fields: ['id', 'documentId', 'workspaceId', 'key', 'name', 'color', 'isActive'] };
        }
        if (typeof value === 'object') {
          const next = { ...value };
          if (next.populate && typeof next.populate === 'object' && Object.prototype.hasOwnProperty.call(next.populate, 'chats')) {
            const { chats: _ignored, ...rest } = next.populate;
            next.populate = rest;
          }
          return next;
        }
        return value;
      };

      // Remove deprecated populate keys
      if (Object.prototype.hasOwnProperty.call(populate, 'assignedByAgent')) {
        delete populate.assignedByAgent;
      }

      if (Object.prototype.hasOwnProperty.call(populate, 'labels')) {
        populate.labels = normalizeLabelsPopulate(populate.labels);
      }

      ctx.query.populate = populate;
    }

    return super.find(ctx);
  },

  async findOne(ctx) {
    const resolvedDocumentId = await resolveChatIdParamToDocumentId(strapi, ctx.params.id);
    if (!resolvedDocumentId) return ctx.notFound('Chat not found');

    ctx.params.id = String(resolvedDocumentId);
    return super.findOne(ctx);
  },

  async update(ctx) {
    const resolvedDocumentId = await resolveChatIdParamToDocumentId(strapi, ctx.params.id);
    if (!resolvedDocumentId) return ctx.notFound('Chat not found');

    ctx.params.id = String(resolvedDocumentId);

    const bodyData = (ctx.request && ctx.request.body && ctx.request.body.data) || null;
    const userId = ctx.state && ctx.state.user && ctx.state.user.id;

    if (bodyData) {
      // Strip deprecated fields
      if (Object.prototype.hasOwnProperty.call(bodyData, 'assignedByAgent')) {
        delete bodyData.assignedByAgent;
      }

      // Unified dropdown inputs from frontend
      if (Object.prototype.hasOwnProperty.call(bodyData, 'assigneeRef')) {
        const ref = parseActorRef(bodyData.assigneeRef);
        delete bodyData.assigneeRef;

        if (!ref) {
          bodyData.assignee = null;
          bodyData.assigneeAgent = null;
        } else if (ref.type === 'agent') {
          bodyData.assignee = null;
          bodyData.assigneeAgent = ref.id;
        } else {
          bodyData.assignee = ref.id;
          bodyData.assigneeAgent = null;
        }
      }

      if (Object.prototype.hasOwnProperty.call(bodyData, 'assignedByRef')) {
        const ref = parseActorRef(bodyData.assignedByRef);
        delete bodyData.assignedByRef;

        // assignedByAgent field removed; keep only user assignment
        if (!ref || ref.type === 'agent') {
          bodyData.assignedBy = null;
        } else {
          bodyData.assignedBy = ref.id;
        }
      }
    }

    // Maintain assignment fields when assignee is changed via update
    if (
      bodyData &&
      (Object.prototype.hasOwnProperty.call(bodyData, 'assignee') ||
        Object.prototype.hasOwnProperty.call(bodyData, 'assigneeAgent'))
    ) {
      const nextAssignee = bodyData.assignee;
      const nextAssigneeAgent = bodyData.assigneeAgent;
      const hasAnyAssignee = nextAssignee !== null && nextAssignee !== undefined ? Boolean(nextAssignee) : Boolean(nextAssigneeAgent);

      // Unassign (null)
      if (nextAssignee === null && (nextAssigneeAgent === null || nextAssigneeAgent === undefined)) {
        bodyData.assignedAt = null;
        bodyData.assignedBy = userId || null;
        bodyData.assignmentStatus = 'unassigned';
      } else if (hasAnyAssignee) {
        // Assign
        if (!bodyData.assignedAt) bodyData.assignedAt = new Date();
        if (userId && !Object.prototype.hasOwnProperty.call(bodyData, 'assignedBy')) {
          bodyData.assignedBy = userId;
        }
        if (!bodyData.assignmentStatus) bodyData.assignmentStatus = 'assigned';
      }

      ctx.request.body.data = bodyData;
    }

    return super.update(ctx);
  },

  async delete(ctx) {
    const resolvedDocumentId = await resolveChatIdParamToDocumentId(strapi, ctx.params.id);
    if (!resolvedDocumentId) return ctx.notFound('Chat not found');

    ctx.params.id = String(resolvedDocumentId);
    return super.delete(ctx);
  },

  async create(ctx) {
    const bodyData = (ctx.request && ctx.request.body && ctx.request.body.data) || null;

    if (bodyData && bodyData.workspaceId && bodyData.channel && bodyData.visitorId) {
      const widgetSettingId = bodyData.widgetSettingId || (bodyData.metadata && bodyData.metadata.widgetSettingId);

      const where = {
        workspaceId: bodyData.workspaceId,
        channel: bodyData.channel,
        visitorId: bodyData.visitorId,
        status: {
          $in: ['open', 'pending'],
        },
      };

      // For widget channel, separate conversations per widgetSettingId when provided
      if (bodyData.channel === 'widget' && widgetSettingId) {
        where.widgetSettingId = widgetSettingId;
      }

      const existing = await strapi.db.query('api::ex-chat.ex-chat').findOne({
        where,
        orderBy: { updatedAt: 'desc' },
      });

      if (existing) {
        const sanitizedEntity = await this.sanitizeOutput(existing, ctx);
        return this.transformResponse(sanitizedEntity);
      }
    }

    const response = await super.create(ctx);

    const io = getIO();
    if (io && response.data) {
      const workspaceId = response.data.workspaceId || (response.data.attributes && response.data.attributes.workspaceId);
      if (workspaceId) {
        io.to(`ws:${workspaceId}`).emit('conversation:new', response.data);
      }
    }

    return response;
  },

  async assignmentActorOptions(ctx) {
    const users = await strapi.db.query('plugin::users-permissions.user').findMany({
      select: ['id', 'username', 'email'],
      orderBy: { username: 'asc' },
    });

    const agents = await strapi.db.query('api::agent.agent').findMany({
      select: ['id', 'documentId', 'name', 'modelProvider', 'modelName'],
      orderBy: { name: 'asc' },
    });

    const options = [
      ...agents.map((a) => ({
        type: 'agent',
        id: a.id,
        documentId: a.documentId,
        label: a.name,
        modelProvider: a.modelProvider,
        modelName: a.modelName,
      })),
      ...users.map((u) => ({
        type: 'user',
        id: u.id,
        label: u.username || u.email || String(u.id),
        email: u.email,
      })),
    ];

    ctx.body = { data: options };
  },
}));
