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

      // Enforce inviter must be a member of this workspace
      const membership = await strapi.entityService.findMany('api::workspace-role.workspace-role', {
        fields: ['id'],
        filters: {
          workspace: workspaceIdInt,
          users: { id: { $eq: userId } },
        },
        limit: 1,
      });

      if (!membership || membership.length === 0) {
        // Fallback: if user is workspace owner but membership table not bootstrapped yet, auto-create/ensure owner role
        const ws = await strapi.entityService.findOne('api::workspace.workspace', workspaceIdInt, {
          populate: { owner: { fields: ['id'] } },
        });

        const ownerId = ws && ws.owner && ws.owner.id;
        strapi.log.info(
          `[INVITATION] create: no membership found userId=${userId} workspaceId=${workspaceIdInt} workspaceOwnerId=${ownerId || '-'} resolvedWorkspaceIdentifier=${resolvedWorkspaceId}`
        );
        if (!ownerId || ownerId !== userId) {
          try {
            const anyMembership = await strapi.entityService.findMany('api::workspace-role.workspace-role', {
              fields: ['id', 'role', 'is_administrator'],
              populate: { workspace: { fields: ['id', 'documentId', 'workspace_name'] } },
              filters: { users: { id: { $eq: userId } } },
              limit: 20,
            });

            const summary = (anyMembership || []).map((r) => {
              const w = r.workspace;
              return {
                workspaceId: w && w.id,
                workspaceDocumentId: w && w.documentId,
                role: r.role,
                is_administrator: r.is_administrator,
              };
            });

            strapi.log.warn(
              `[INVITATION] create forbidden debug: userId=${userId} memberships=${JSON.stringify(summary)}`
            );
          } catch (e) {
            strapi.log.warn(`[INVITATION] create forbidden debug failed: ${e.message}`);
          }

          strapi.log.warn(
            `[INVITATION] create forbidden: user is not workspace member/owner userId=${userId} workspaceId=${workspaceIdInt} workspaceOwnerId=${ownerId || '-'} resolvedWorkspaceIdentifier=${resolvedWorkspaceId}`
          );
          return ctx.forbidden('You are not a member of this workspace');
        }

        const existingOwnerRoles = await strapi.entityService.findMany('api::workspace-role.workspace-role', {
          fields: ['id'],
          filters: {
            workspace: workspaceIdInt,
            role: { $eq: 'owner' },
          },
          limit: 1,
        });

        const ownerRole = existingOwnerRoles && existingOwnerRoles[0];
        if (ownerRole && ownerRole.id) {
          strapi.log.info(
            `[INVITATION] create: bootstrapping owner membership by connecting userId=${userId} to existing ownerRoleId=${ownerRole.id} workspaceId=${workspaceIdInt}`
          );
          await strapi.entityService.update('api::workspace-role.workspace-role', ownerRole.id, {
            data: { users: { connect: [{ id: userId }] } },
          });
        } else {
          strapi.log.info(
            `[INVITATION] create: bootstrapping owner membership by creating owner role and connecting userId=${userId} workspaceId=${workspaceIdInt}`
          );
          await strapi.entityService.create('api::workspace-role.workspace-role', {
            data: {
              role: 'owner',
              is_administrator: true,
              is_default: false,
              is_deletable: false,
              workspace: workspaceIdInt,
              users: { connect: [{ id: userId }] },
            },
          });
        }
      }

      const workspace = await strapi.entityService.findOne('api::workspace.workspace', workspaceIdInt);
      if (!workspace) {
        return ctx.badRequest('Workspace not found');
      }

      const roleIdInt = await this.resolveIdToInteger('api::workspace-role.workspace-role', resolvedRoleId);
      if (!roleIdInt) {
        return ctx.badRequest('Role not found');
      }

      const role = await strapi.entityService.findOne('api::workspace-role.workspace-role', roleIdInt, {
        populate: { workspace: { fields: ['id'] } },
      });
      if (!role) {
        return ctx.badRequest('Role not found');
      }

      const roleWorkspaceId = role.workspace && role.workspace.id;
      if (roleWorkspaceId && roleWorkspaceId !== workspaceIdInt) {
        return ctx.badRequest('Role does not belong to this workspace');
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

        const emailService = strapi.service('api::email-setting.email-setting');
        const html = emailTemplates.getInvitationTemplate(workspace.workspace_name, inviteUrl);

        let result;
        if (emailService && emailService.sendEmail) {
          result = await emailService.sendEmail({
            to: email,
            from: fromEmail,
            subject: 'คำเชิญเข้าร่วม Workspace',
            html,
            workspaceId: workspaceIdInt,
          });
        } else {
          result = await strapi.plugin('email').service('email').send({
            to: email,
            from: fromEmail,
            subject: 'คำเชิญเข้าร่วม Workspace',
            html,
          });
        }

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
    const body = ctx.request.body?.data || ctx.request.body;
    const { token } = body || {};

    if (!token) {
      return ctx.badRequest('Token is required');
    }

    const userId = ctx.state && ctx.state.user && ctx.state.user.id;
    if (!userId) {
      return ctx.unauthorized('Login required');
    }

    try {
      const invitation = await strapi.entityService.findMany('api::invitation.invitation', {
        filters: { token, consumed: false },
        populate: {
          workspace: { fields: ['id', 'documentId', 'workspace_name'] },
          workspace_role: { fields: ['id', 'documentId', 'role'] },
        },
        limit: 1,
      });

      if (!invitation || invitation.length === 0) {
        return ctx.badRequest('Invalid or expired invitation');
      }

      const record = invitation[0];

      if (new Date(record.expiresAt) < new Date()) {
        return ctx.badRequest('Invitation has expired');
      }

      const workspace = record.workspace;
      if (!workspace || !workspace.id) {
        return ctx.badRequest('Workspace not found');
      }

      const invitationRole = record.workspace_role;
      if (!invitationRole || !invitationRole.id) {
        return ctx.badRequest('Invitation is missing workspace role');
      }

      const roleEntity = await strapi.entityService.findOne(
        'api::workspace-role.workspace-role',
        invitationRole.id,
        {
          populate: {
            workspace: { fields: ['id'] },
            users: { fields: ['id'] },
          },
        }
      );

      if (!roleEntity) {
        return ctx.badRequest('Role not found');
      }

      const roleWorkspaceId = roleEntity.workspace && roleEntity.workspace.id;
      if (roleWorkspaceId && Number(roleWorkspaceId) !== Number(workspace.id)) {
        return ctx.badRequest('Invitation role does not belong to workspace');
      }

      const existingUsers = Array.isArray(roleEntity.users) ? roleEntity.users : [];
      const alreadyMember = existingUsers.some((u) => Number(u && u.id) === Number(userId));
      if (!alreadyMember) {
        await strapi.entityService.update('api::workspace-role.workspace-role', roleEntity.id, {
          data: {
            users: { connect: [{ id: userId }] },
          },
        });
      }

      await strapi.entityService.update('api::invitation.invitation', record.id, {
        data: { consumed: true },
      });

      ctx.send({
        message: 'Invitation accepted',
        workspace: {
          id: workspace.id,
          documentId: workspace.documentId,
          workspace_name: workspace.workspace_name,
        },
        role: {
          id: invitationRole.id,
          documentId: invitationRole.documentId,
          role: invitationRole.role,
        },
      });
    } catch (error) {
      strapi.log.error(`Failed to accept invitation: ${error.message}`);
      ctx.badRequest('Failed to accept invitation');
    }
  },
}));
