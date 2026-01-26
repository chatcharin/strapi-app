'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const crypto = require('crypto');
const emailTemplates = require('../../email-verification/services/email-templates');

module.exports = createCoreController('api::invitation.invitation', ({ strapi }) => ({
  async createInvitation(ctx) {
    const { email, workspaceId, roleId } = ctx.request.body;
    const userId = ctx.state.user.id;

    if (!email || !workspaceId || !roleId) {
      return ctx.badRequest('Email, workspaceId, and roleId are required');
    }

    try {
      const workspace = await strapi.entityService.findOne('api::workspace.workspace', workspaceId);
      if (!workspace) {
        return ctx.badRequest('Workspace not found');
      }

      const role = await strapi.entityService.findOne('api::workspace-role.workspace-role', roleId);
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
          workspace: workspaceId,
          workspace_role: roleId,
          invited_by: userId,
        },
      });

      const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/join?token=${token}`;

      const fromEmail = workspace.email || process.env.EMAIL_FROM || 'noreply@yourdomain.com';

      await strapi.plugin('email').service('email').send({
        to: email,
        from: fromEmail,
        subject: 'คำเชิญเข้าร่วม Workspace',
        html: emailTemplates.getInvitationTemplate(workspace.workspace_name, inviteUrl),
      });

      ctx.send({ message: 'Invitation sent successfully', invitation });
    } catch (error) {
      console.error('Failed to create invitation:', error);
      ctx.badRequest('Failed to create invitation');
    }
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
