import settings from '../settings.js';

function isOwner(senderId) {
    const owner = settings.ownerNumber + '@s.whatsapp.net';
    return senderId === owner;
}

export default isOwner;