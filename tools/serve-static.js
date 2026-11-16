import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
export async function serveStatic(directory,{prefix='/',port=0}={}){
 const root=path.resolve(directory),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webm':'video/webm','.glb':'model/gltf-binary','.txt':'text/plain','.md':'text/plain'};
 const server=http.createServer(async(req,res)=>{try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(!pathname.startsWith(prefix)){res.writeHead(404);return res.end();}
  const relative=pathname.slice(prefix.length)||'index.html',file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}const bytes=await readFile(file);let start=0,end=bytes.length-1;
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Accept-Ranges','bytes');
  if(req.headers.range){const match=req.headers.range.match(/^bytes=(\d+)-(\d*)$/);if(!match){res.writeHead(416);return res.end();}start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;if(start>end){res.writeHead(416);return res.end();}res.setHeader('Content-Range',`bytes ${start}-${end}/${bytes.length}`);res.statusCode=206;}
  res.setHeader('Content-Length',end-start+1);res.end(req.method==='HEAD'?undefined:bytes.subarray(start,end+1));
 }catch(error){res.writeHead(error.code==='ENOENT'||error.code==='EISDIR'?404:400);res.end('Not found');}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 return {base:`http://127.0.0.1:${server.address().port}${prefix}`,async stop(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const dir=process.argv[2]||'.site';await stat(dir);const server=await serveStatic(dir,{port:Number(process.env.PORT||8080)});console.log(server.base);}
