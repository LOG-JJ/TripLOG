const {spawn}=require('node:child_process');
const {createServer}=require('./serve-test');
async function main(){
  const server=createServer({pagesRedirects:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    for(const file of ['sync-browser-regression.js','sync-offline-browser-regression.js','sync-navigation-recovery-regression.js','sync-auto-update-browser-regression.js','trip-chooser-browser-regression.js','itinerary-drag-browser-regression.js','itinerary-touch-drag-browser-regression.js','controls-browser-regression.js','time-wheel-browser-regression.js','itinerary-controls-browser-regression.js','transit-journey-browser-regression.js','companion-passport-browser-regression.js','wallet-passbook-browser-regression.js','map-provider-browser-regression.js','domestic-route-browser-regression.js','expense-ui-browser-regression.js','reservation-expense-editor-browser-regression.js','expense-filter-browser-regression.js']){
      await new Promise((resolve,reject)=>{
        const child=spawn(process.execPath,[require('node:path').join(__dirname,file)],{stdio:'inherit',env:{...process.env,TRIPLOG_TEST_URL:`http://127.0.0.1:${server.address().port}`}});
        child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${file} failed (${code})`)));
      });
    }
  }finally{await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
