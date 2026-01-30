'use strict';

module.exports = {
  async sendContactEmail(workspaceId, payload) {
    const workspace = await strapi.db.query('api::workspace.workspace').findOne({
      where: { id: workspaceId },
      select: ['workspace_name', 'contact_email'],
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    if (!workspace.contact_email) {
      throw new Error('Workspace has no contact email');
    }

    const { message, fromName } = payload || {};

    await strapi.plugin('email').service('email').send({
      to: process.env.CONTACT_RECEIVER_EMAIL || process.env.EMAIL_FROM || 'admin@example.com',
      subject: `ติดต่อจาก ${workspace.workspace_name}`,
      from: process.env.EMAIL_FROM || undefined,
      replyTo: workspace.contact_email,
      html: `
        <p><b>Workspace:</b> ${workspace.workspace_name}</p>
        <p><b>Contact email:</b> ${workspace.contact_email}</p>
        <p><b>From name:</b> ${fromName || '-'}</p>
        <p><b>Message:</b></p>
        <p>${message || '-'}</p>
      `,
    });

    return { ok: true };
  },
};
