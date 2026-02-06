'use strict';

module.exports = {
  async beforeDelete(event) {
    const { where } = event.params;
    
    // Fetch the role being deleted
    const role = await strapi.entityService.findOne('api::workspace-role.workspace-role', where.id, {
      fields: ['role', 'is_deletable'],
    });

    if (role && role.is_deletable === false) {
      throw new Error(`Cannot delete default role "${role.role}". This role is protected.`);
    }
  },

  async beforeDeleteMany(event) {
    const { where } = event.params;
    
    // Fetch roles matching the criteria
    const roles = await strapi.entityService.findMany('api::workspace-role.workspace-role', {
      where,
      fields: ['role', 'is_deletable'],
    });

    const protectedRoles = roles.filter(r => r.is_deletable === false);
    
    if (protectedRoles.length > 0) {
      const roleNames = protectedRoles.map(r => r.role).join(', ');
      throw new Error(`Cannot delete protected roles: ${roleNames}`);
    }
  },
};
