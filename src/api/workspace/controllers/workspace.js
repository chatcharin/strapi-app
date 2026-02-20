'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::workspace.workspace', ({ strapi }) => ({
  async find(ctx) {
    // Defensive: some clients pass documentId into filters[id], which breaks Postgres integer casting.
    // Normalize filters so `id` is only used when the value is a numeric string/number.
    if (ctx?.query?.filters) {
      const isNumericString = (v) => {
        if (typeof v !== 'string') return false;
        const asInt = Number.parseInt(v, 10);
        return Number.isFinite(asInt) && String(asInt) === v;
      };

      const normalizeFilterObject = (obj) => {
        if (!obj || typeof obj !== 'object') return;

        // Handle shapes like { id: { $eq: 'abc' } }
        const idFilter = obj.id;
        const eqValue = idFilter && typeof idFilter === 'object' ? idFilter.$eq : undefined;
        if (typeof eqValue === 'string' && !isNumericString(eqValue)) {
          // Prefer documentId for non-numeric identifiers
          if (!obj.documentId) {
            obj.documentId = { $eq: eqValue };
          }
          delete obj.id;
        }
      };

      const filters = ctx.query.filters;
      // Normalize top-level
      normalizeFilterObject(filters);
      // Normalize OR branches
      if (Array.isArray(filters.$or)) {
        for (const branch of filters.$or) {
          normalizeFilterObject(branch);
        }
      }
    }

    return await super.find(ctx);
  },

  // Helper to resolve UUID documentId to integer ID
  async resolveIdToInteger(api, identifier) {
    if (identifier === undefined || identifier === null) return undefined;

    if (typeof identifier === 'number') {
      return identifier;
    }

    const raw = String(identifier);
    const asInt = Number.parseInt(raw, 10);

    if (Number.isFinite(asInt) && String(asInt) === raw) {
      return asInt;
    }

    const result = await strapi.entityService.findMany(api, {
      fields: ['id'],
      filters: { documentId: raw },
      limit: 1,
    });

    return result?.[0]?.id;
  },

  async findByDocument(ctx) {
    const { docId } = ctx.params;

    if (!docId) return ctx.badRequest('docId is required');

    try {
      const docs = await strapi.entityService.findMany('api::document.document', {
        filters: { docId },
        populate: ['workspace'],
        limit: 1,
      });

      if (docs.length === 0 || !docs[0].workspace) {
        return ctx.notFound('Workspace not found for this document');
      }

      return ctx.send({ workspace: docs[0].workspace });
    } catch (error) {
      strapi.log.error('Failed to find workspace by document', error);
      return ctx.badRequest('Failed to find workspace');
    }
  },

  async contact(ctx) {
    const { id } = ctx.params;
    const payload = ctx.request.body;

    if (!id) return ctx.badRequest('Workspace id is required');

    try {
      const result = await strapi.service('api::workspace.workspace-mail').sendContactEmail(id, payload);
      return ctx.send(result);
    } catch (error) {
      strapi.log.error('Failed to send workspace contact email', error);
      return ctx.badRequest(error.message || 'Failed to send contact email');
    }
  },

  async setSelectedWorkspace(ctx) {
    const { id } = ctx.params;
    const userId = ctx.state.user?.id;

    if (!id) return ctx.badRequest('Workspace id is required');

    // One-year expiry
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);

    // Name aligned with frontend helper
    const cookieName = process.env.SELECTED_WS_COOKIE || 'selectedWorkspaceId';

    ctx.cookies.set(cookieName, encodeURIComponent(id), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires,
      path: '/',
      // Bind to session/user if desired; Strapi sets signed cookies via keys
      // We keep it unsigned to allow cross-service read, but HttpOnly prevents JS access
    });

    strapi.log.info('Set selected workspace cookie', { userId, workspaceId: id });

    return ctx.send({ ok: true, workspaceId: id });
  },

  async changeOwner(ctx) {
    const { id } = ctx.params;
    const userId = ctx.state.user?.id;
    const body = ctx.request.body?.data || ctx.request.body;
    const newOwnerIdentifier = body?.newOwnerId || body?.newOwner || body?.userId;

    if (!userId) return ctx.unauthorized('You must be authenticated');
    if (!id) return ctx.badRequest('Workspace id is required');
    if (!newOwnerIdentifier) return ctx.badRequest('newOwnerId is required');

    const workspaceIdInt = await this.resolveIdToInteger('api::workspace.workspace', id);
    if (!workspaceIdInt) return ctx.badRequest('Workspace not found');

    const newOwnerIdInt = await this.resolveIdToInteger('plugin::users-permissions.user', newOwnerIdentifier);
    if (!newOwnerIdInt) return ctx.badRequest('New owner not found');

    const workspace = await strapi.entityService.findOne('api::workspace.workspace', workspaceIdInt, {
      populate: ['owner'],
    });

    if (!workspace) return ctx.badRequest('Workspace not found');

    const currentOwnerId = workspace.owner?.id;
    
    // Check if user is current owner or has admin role
    const userRoles = await strapi.entityService.findMany('api::workspace-role.workspace-role', {
      fields: ['id', 'role', 'is_administrator'],
      filters: {
        workspace: workspaceIdInt,
        users: { id: { $eq: userId } },
      },
    });
    
    const isAdmin = userRoles.some(r => r.is_administrator || r.role === 'admin' || r.role === 'owner');
    
    if (!currentOwnerId || (currentOwnerId !== userId && !isAdmin)) {
      return ctx.forbidden('Only current owner or admin can change owner');
    }

    // Ensure new owner is a member in this workspace (via workspace-role.users)
    const targetRoles = await strapi.entityService.findMany('api::workspace-role.workspace-role', {
      fields: ['id', 'role'],
      filters: {
        workspace: workspaceIdInt,
        users: { id: { $eq: newOwnerIdInt } },
      },
      limit: 1,
    });

    if (!targetRoles || targetRoles.length === 0) {
      return ctx.badRequest('New owner must be a workspace member');
    }

    // Find owner role record for this workspace
    const ownerRoles = await strapi.entityService.findMany('api::workspace-role.workspace-role', {
      fields: ['id', 'role'],
      filters: {
        workspace: workspaceIdInt,
        role: { $eq: 'owner' },
      },
      limit: 1,
    });

    const ownerRole = ownerRoles?.[0];
    if (!ownerRole) {
      return ctx.badRequest('Owner role not found for this workspace');
    }

    // Find admin role record for this workspace (fallback: any role containing current owner)
    const adminRoles = await strapi.entityService.findMany('api::workspace-role.workspace-role', {
      fields: ['id', 'role'],
      filters: {
        workspace: workspaceIdInt,
        role: { $eq: 'admin' },
      },
      limit: 1,
    });
    const adminRole = adminRoles?.[0];

    // Ensure current owner is in owner role
    const ownerRoleWithUsers = await strapi.entityService.findOne('api::workspace-role.workspace-role', ownerRole.id, {
      populate: ['users'],
    });
    const ownerUserIds = (ownerRoleWithUsers?.users || []).map((u) => u.id);

    if (!ownerUserIds.includes(userId)) {
      return ctx.badRequest('Current owner is not assigned to owner role');
    }

    // Transaction: update workspace.owner, move users between role lists
    await strapi.db.connection.transaction(async (trx) => {
      // Update workspace owner relation
      await strapi.entityService.update('api::workspace.workspace', workspaceIdInt, {
        data: {
          owner: newOwnerIdInt,
        },
        transaction: trx,
      });

      // Add new owner to owner role
      const nextOwnerUserIds = Array.from(new Set([...ownerUserIds.filter((uid) => uid !== userId), newOwnerIdInt]));
      await strapi.entityService.update('api::workspace-role.workspace-role', ownerRole.id, {
        data: {
          users: nextOwnerUserIds,
        },
        transaction: trx,
      });

      // Move old owner to admin role (if exists)
      if (adminRole) {
        const adminRoleWithUsers = await strapi.entityService.findOne('api::workspace-role.workspace-role', adminRole.id, {
          populate: ['users'],
          transaction: trx,
        });
        const adminUserIds = (adminRoleWithUsers?.users || []).map((u) => u.id);
        if (!adminUserIds.includes(userId)) {
          await strapi.entityService.update('api::workspace-role.workspace-role', adminRole.id, {
            data: {
              users: Array.from(new Set([...adminUserIds, userId])),
            },
            transaction: trx,
          });
        }
      }
    });

    return ctx.send({ ok: true, workspaceId: workspaceIdInt, newOwnerId: newOwnerIdInt });
  },
}));
