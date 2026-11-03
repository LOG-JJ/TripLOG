require('./helpers/companion-experience-browser').run('analysis').catch(error => { console.error(error); process.exitCode = 1; });
