// Current approved companion UI; legacy adjustment math remains covered by the model suite.
require('./helpers/companion-experience-browser').run('wallet').catch(error => { console.error(error); process.exitCode = 1; });
