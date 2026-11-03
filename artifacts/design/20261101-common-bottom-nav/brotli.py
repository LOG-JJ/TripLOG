"""Use Node's bundled Brotli decoder to read the existing WOFF2, without pip."""
import subprocess
def decompress(data):
    return subprocess.run(['node','-e',"const z=require('node:zlib'),chunks=[];process.stdin.on('data',c=>chunks.push(c));process.stdin.on('end',()=>process.stdout.write(z.brotliDecompressSync(Buffer.concat(chunks))));"],input=data,stdout=subprocess.PIPE,check=True).stdout
