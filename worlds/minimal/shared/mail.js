import {definition} from './definition.js';
export const MAILBOXES=definition.mailboxes,MAIL_LIMIT=100,FRIEND_LIMIT=100,MAIL_ATTACHMENTS=6;
export const mailText=(value,limit)=>typeof value==='string'?value.replace(/[\x00-\x08\x0b-\x1f\x7f]/g,'').trim().slice(0,limit):'';
