try {
  const response=await fetch(`http://127.0.0.1:${process.env.PORT||3080}/ready`,{signal:AbortSignal.timeout(2500)});
  process.exitCode=response.ok?0:1;
}catch{process.exitCode=1;}
