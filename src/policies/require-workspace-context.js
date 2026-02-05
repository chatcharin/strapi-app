'use strict';

const resolveIdToInteger = async (strapi, api, identifier) => {
  if (identifier === undefined || identifier === null) return undefined;

  if (typeof identifier === 'number') return identifier;

  const raw = String(identifier);
  const asInt = Number.parseInt(raw, 10);

  // Numeric string
  if (Number.isFinite(asInt) && String(asInt) === raw) {
    return asInt;
  }

  // Assume documentId
  const result = await strapi.entityService.findMany(api, {
    fields: ['id'],
    filters: { documentId: raw },
    limit: 1,
  });

  return result?.[0]?.id;
};

module.exports = async (policyContext, config, { strapi }) => {
  const ctx = policyContext?.ctx;
  if (!ctx) {
    // If Strapi did not pass a ctx, fail fast instead of throwing
    return false;
  }

  const userId = ctx.state?.user?.id;
  if (!userId) {
    return ctx.unauthorized('You must be authenticated');
  }

  const headerWorkspaceId = ctx.request.headers['x-workspace-id'];
  const cookieName = process.env.SELECTED_WS_COOKIE || 'selectedWorkspaceId';
  const cookieWorkspaceId = ctx.cookies.get(cookieName);

  let rawWorkspaceIdentifier = headerWorkspaceId || cookieWorkspaceId;

  // Fallback: pick the first workspace the user belongs to (helps read-only flows when header/cookie missing)
  if (!rawWorkspaceIdentifier) {
    const membership = await strapi.entityService.findMany('api::workspace-role.workspace-role', {
      fields: ['id'],
      populate: ['workspace'],
      filters: { users: { id: { $eq: userId } } },
      limit: 1,
    });

    const workspaceFromMembership = membership?.[0]?.workspace;
    if (!workspaceFromMembership) {
      return ctx.badRequest('Workspace context is required');
    }

    rawWorkspaceIdentifier = workspaceFromMembership.id || workspaceFromMembership;
  }

  let workspaceIdInt = await resolveIdToInteger(strapi, 'api::workspace.workspace', rawWorkspaceIdentifier);
  if (!workspaceIdInt) {
    return ctx.badRequest('Workspace not found');
  }

  // Validate membership using existing model: workspace-role.users
  let roles = await strapi.entityService.findMany('api::workspace-role.workspace-role', {
    fields: ['id', 'role', 'is_administrator'],
    filters: {
      workspace: workspaceIdInt,
      users: { id: { $eq: userId } },
    },
    limit: 1,
  });

  let workspaceRole = roles?.[0];

  // If user provided workspace they are not in, fallback to first membership instead of 403
  if (!workspaceRole) {
    const anyMembership = await strapi.entityService.findMany('api::workspace-role.workspace-role', {
      fields: ['id', 'role', 'is_administrator'],
      populate: ['workspace'],
      filters: { users: { id: { $eq: userId } } },
      limit: 1,
    });

    const fallbackWorkspace = anyMembership?.[0]?.workspace;
    if (!fallbackWorkspace) {
      return ctx.forbidden('You are not a member of this workspace');
    }

    // Switch to fallback workspace
    const fallbackId = fallbackWorkspace.id || fallbackWorkspace;
    roles = anyMembership;
    workspaceRole = anyMembership[0];
    rawWorkspaceIdentifier = fallbackId;
    // reuse resolution logic to keep consistency
    const resolved = await resolveIdToInteger(strapi, 'api::workspace.workspace', fallbackId);
    if (!resolved) {
      return ctx.badRequest('Workspace not found');
    }
    workspaceIdInt = resolved;
  }

  // Attach to ctx.state for controllers/services
  ctx.state.workspace = { id: workspaceIdInt };
  ctx.state.workspaceId = workspaceIdInt;
  ctx.state.workspaceRole = workspaceRole;

  // Enforce workspace scoping (best-effort)
  // - For queries: automatically add workspace filter
  if (ctx.query) {
    ctx.query.filters = ctx.query.filters || {};
    if (!ctx.query.filters.workspace) {
      ctx.query.filters.workspace = workspaceIdInt;
    }
  }

  // - For create/update payloads: ensure workspace is set to selected one
  const body = ctx.request.body?.data || ctx.request.body;
  if (body && typeof body === 'object') {
    if (body.workspace && String(body.workspace) !== String(workspaceIdInt) && String(body.workspace) !== String(rawWorkspaceIdentifier)) {
      return ctx.badRequest('Workspace mismatch');
    }
    if (!body.workspace) {
      body.workspace = workspaceIdInt;
    }
    if (ctx.request.body?.data) {
      ctx.request.body.data = body;
    } else {
      ctx.request.body = body;
    }
  }

  return true;
};
