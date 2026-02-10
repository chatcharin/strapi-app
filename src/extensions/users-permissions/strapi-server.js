'use strict';

const pickPublicUser = (user) => {
  if (!user) return user;

  const { id, username, email, full_name, bio, avatar_url, account_type } = user;

  return {
    id,
    username,
    email,
    full_name,
    bio,
    avatar_url,
    account_type,
  };
};

module.exports = (plugin) => {
  plugin.controllers.user = plugin.controllers.user || {};

  plugin.controllers.user.updateMe = async (ctx) => {
    const authUser = ctx.state.user;

    if (!authUser?.id) {
      return ctx.unauthorized('You must be authenticated');
    }

    const { full_name, bio, avatar_url } = ctx.request.body || {};

    const data = {};
    if (full_name !== undefined) data.full_name = full_name;
    if (bio !== undefined) data.bio = bio;
    if (avatar_url !== undefined) data.avatar_url = avatar_url;

    const updatedUser = await strapi.entityService.update('plugin::users-permissions.user', authUser.id, {
      data,
    });

    return ctx.send({ user: pickPublicUser(updatedUser) });
  };

  plugin.controllers.user.deleteMe = async (ctx) => {
    const authUser = ctx.state.user;

    if (!authUser?.id) {
      return ctx.unauthorized('You must be authenticated');
    }

    await strapi.entityService.delete('plugin::users-permissions.user', authUser.id);

    return ctx.send({ ok: true });
  };

  if (plugin.routes?.['content-api']?.routes) {
    plugin.routes['content-api'].routes.push(
      {
        method: 'PUT',
        path: '/users/me',
        handler: 'user.updateMe',
        info: {
          type: 'content-api',
        },
        config: {
          auth: { type: 'authenticated', scope: ['authenticated'] },
          policies: [],
        },
      },
      {
        method: 'DELETE',
        path: '/users/me',
        handler: 'user.deleteMe',
        info: {
          type: 'content-api',
        },
        config: {
          auth: { type: 'authenticated', scope: ['authenticated'] },
          policies: [],
        },
      }
    );
  }

  return plugin;
};
