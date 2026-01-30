'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const crypto = require('crypto');
const emailTemplates = require('../../email-verification/services/email-templates');

module.exports = createCoreController('api::invitation.invitation', ({ strapi }) => ({
  // Helper to resolve UUID documentId to integer ID
  async resolveIdToInteger(api, identifier) {
    // If already a number, return it
    if (typeof identifier === 'number') {
      return identifier;
    }
    // If it's a numeric string, convert to number
    if (!isNaN(parseInt(identifier))) {
      return parseInt(identifier);
    }
    // Otherwise assume it's a UUID documentId and find the integer ID
    strapi.log.info(`Resolving ${api} documentId: ${identifier}`);
    const result = await strapi.entityService.findMany(api, {
      fields: ['id'],
      filters: { documentId: identifier },
      limit: 1,
    });
    const resolvedId = result[0]?.id;
    strapi.log.info(`Resolved ${api} documentId ${identifier} to integer ID: ${resolvedId}`);
    return resolvedId;
  },

  async create(ctx) {
    const body = ctx.request.body?.data || ctx.request.body;
    const {
      email,
      workspaceId,
      roleId,
      workspace,
      workspace_role,
    } = body || {};

    const resolvedWorkspaceId = workspaceId || workspace?.id || workspace;
    const resolvedRoleId = roleId || workspace_role?.id || workspace_role;

    const userId = ctx.state.user.id;

    if (!email || !resolvedWorkspaceId || !resolvedRoleId) {
      return ctx.badRequest('Email, workspaceId, and roleId are required');
    }

    try {
      const workspaceIdInt = await this.resolveIdToInteger('api::workspace.workspace', resolvedWorkspaceId);
      if (!workspaceIdInt) {
        return ctx.badRequest('Workspace not found');
      }

      const workspace = await strapi.entityService.findOne('api::workspace.workspace', workspaceIdInt);
      if (!workspace) {
        return ctx.badRequest('Workspace not found');
      }

      const roleIdInt = await this.resolveIdToInteger('api::workspace-role.workspace-role', resolvedRoleId);
      if (!roleIdInt) {
        return ctx.badRequest('Role not found');
      }

      const role = await strapi.entityService.findOne('api::workspace-role.workspace-role', roleIdInt);
      if (!role) {
        return ctx.badRequest('Role not found');
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const invitation = await strapi.entityService.create('api::invitation.invitation', {
        data: {
          email,
          token,
          expiresAt,
          consumed: false,
          workspace: workspaceIdInt,
          workspace_role: roleIdInt,
          invited_by: userId,
        },
      });

      const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/join?token=${token}`;

      const fromEmail = process.env.EMAIL_FROM || 'noreply@yourdomain.com';

      try {
        strapi.log.info('Sending invitation email', {
          to: email,
          fromEmail,
          workspaceId,
          inviteUrl,
        });

        const result = await strapi.plugin('email').service('email').send({
          to: email,
          from: fromEmail,
          subject: 'คำเชิญเข้าร่วม Workspace',
          html: emailTemplates.getInvitationTemplate(workspace.workspace_name, inviteUrl),
        });

        if (result) {
          strapi.log.info('Invitation email send result', result);
        }
      } catch (sendError) {
        strapi.log.error('Failed to send invitation email', {
          error: sendError?.message,
          code: sendError?.code,
          response: sendError?.response,
        });
        throw sendError;
      }

      ctx.send({ message: 'Invitation sent successfully', invitation });
    } catch (error) {
      console.error('Failed to create invitation:', error);
      ctx.badRequest('Failed to create invitation');
    }
  },

  // Backward compatibility for custom route handler
  async createInvitation(ctx) {
    return this.create(ctx);
  },

  async acceptInvitation(ctx) {
    const { token } = ctx.request.body;

    if (!token) {
      return ctx.badRequest('Token is required');
    }

    try {
      const invitation = await strapi.entityService.findMany('api::invitation.invitation', {
        filters: { token, consumed: false },
        populate: ['workspace', 'workspace_role'],
        limit: 1,
      });

      if (invitation.length === 0) {
        return ctx.badRequest('Invalid or expired invitation');
      }

      const record = invitation[0];

      if (new Date(record.expiresAt) < new Date()) {
        return ctx.badRequest('Invitation has expired');
      }

      ctx.send({
        message: 'Invitation valid',
        workspace: record.workspace,
        role: record.workspace_role,
        email: record.email,
      });
    } catch (error) {
      ctx.badRequest('Failed to accept invitation');
    }
  },
}));
