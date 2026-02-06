'use strict';

module.exports = {
  async afterCreate(event) {
    const { result } = event;
    const workspaceId = result.id;

    // Create default Admin role for the new workspace
    await strapi.entityService.create('api::workspace-role.workspace-role', {
      data: {
        role: 'Admin',
        is_administrator: true,
        is_default: true,
        is_deletable: false,
        content_view_ai_chat: true,
        content_view_file: true,
        content_view_knowledge_base: true,
        content_view_organize: true,
        ai_chat_read: true,
        ai_chat_use: true,
        invitation_method: 'invite_and_register',
        document_request: 'yes',
        workspace: workspaceId,
      },
    });

    strapi.log.info(`Created default Admin role for workspace ${workspaceId}`);
  },
};
