// Deliberately opt-in and local: a URL or request-body flag cannot grant a role.
export function developerAccess(req,enabled=process.env.ENABLE_DEVELOPER_MODE==='1'){
 const address=req.socket?.remoteAddress||'';
 let sameOrigin=true;try{sameOrigin=!req.headers.origin||new URL(req.headers.origin).host===req.headers.host;}catch{return false;}
 return enabled&&(['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address))&&!req.headers.forwarded&&!req.headers['x-forwarded-for']&&sameOrigin;
}
