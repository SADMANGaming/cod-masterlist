const express = require('express');
const dgram = require('dgram');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;
app.use(cors());

// Credits: me ofc, gpt, cod.pm, atvi etc 

// CACHE
let cachedData = {
    cod1_1_1: null,
    cod1_1_5: null,

    coduo_1_41: null,
    coduo_1_51: null,

    cod2_1_0: null,
    cod2_1_2: null,
    cod2_1_3: null,

    cod4_1_0: null,
    cod4_1_7: null,
    cod4_1_8: null
};


async function updateCache() {
    console.log('Refreshing server caches...');

    await Promise.all([
        cacheSpecificGame('cod1', '1.1'),
        cacheSpecificGame('cod1', '1.5'),

        cacheSpecificGame('coduo', '1.41'),
        cacheSpecificGame('coduo', '1.51'),

        cacheSpecificGame('cod2', '1.0'),
        cacheSpecificGame('cod2', '1.2'),
        cacheSpecificGame('cod2', '1.3'),

        cacheSpecificGame('cod4', '1.0'),
        cacheSpecificGame('cod4', '1.7'),
        cacheSpecificGame('cod4', '1.8'),

    ]);
}

async function cacheSpecificGame(game, version) { //thanks chatgpt
    console.log(`Refreshing cache for ${game} ${version}...`);
    getServersFromMaster(game, version, async (err, servers) => {
        if (err) {
            console.error(`Failed to get servers for ${game} ${version}`);
            return;
        }

        /*getServersFromMaster(game, version, err => {
        if (err) {
            console.error(`Failed to get servers for ${game} ${version}`);
            return;
        }*/

        const limited = servers.slice(0, 256);
        const tasks = limited.map(s => () => getServerStatusWithRetry(s.ip, s.port));
        const results = await processInBatches(tasks, 20);

        const validServers = results.filter(s => s);
        validServers.sort((a, b) => b.clients - a.clients);

        const totalCount = validServers.length;
        const extensionCounts = validServers.reduce((acc, server) => {
            acc[server.extensions] = (acc[server.extensions] || 0) + 1;
            return acc;
        }, {});

        const key = gameKey(game, version);
        cachedData[key] = {
            lastUpdated: new Date(),
            totalServers: totalCount,
            extensions: extensionCounts,
            servers: validServers
        };

        /*cachedData[] = {
            lastUpdate: new Date(),
            totalServers: totalCount,
            extensions: extensionCounts,
            servers: validServers
        }; */

        console.log(`Cache updated for ${game} ${version}: ${totalCount} servers.`);
    });
}

function gameKey(game, version) { //also chatgpt
    return game.replace(/\./g, '') + '_' + version.replace(/\./g, '_');
}

updateCache();

// Update cache every 40 seconds
setInterval(updateCache, 40000);
//setTimeout();







const removeColorCodes = (str) => { // yep correct *chatgpt
    return str.replace(/\^([0-7])/g, ''); // Removes only color codes ^0 to ^7
};

const cleanUnwantedTxt = (str) => { // also yes
    let firstOccurrenceFound = false;
    return str.replace(/\u0001/g, (match) => {
        if (!firstOccurrenceFound) {
            firstOccurrenceFound = true;
            return match; // Keep the first occurrence
        }
        return ''; // Remove subsequent occurrences
    });
};




function getServersFromMaster(game, version, callback) { // nope
    let masterServer = '';
    let masterPort = 0;
    let message = null;

    if (game === 'cod1') {
        masterServer = 'codmaster.activision.com';
        masterPort = 20510;
        if (version === '1.1') {
            message = Buffer.from('\xFF\xFF\xFF\xFFgetservers 1 full empty', 'binary');
        } else if (version === '1.5') {
            message = Buffer.from('\xFF\xFF\xFF\xFFgetservers 6 full empty', 'binary');
        }
    } else if (game === 'coduo') {
        masterServer = 'coduomaster.activision.com';
        masterPort = 20610;
        if (version === '1.41') {
            message = Buffer.from('\xFF\xFF\xFF\xFFgetservers 21 full empty', 'binary');
        } else if (version === '1.51') {
            message = Buffer.from('\xFF\xFF\xFF\xFFgetservers 22 full empty', 'binary');
        }
    } else if (game === 'cod2') {
        masterServer = 'cod2master.activision.com';
        masterPort = 20710 ;
        if (version === '1.0') {
            message = Buffer.from('\xFF\xFF\xFF\xFFgetservers 115 full empty', 'binary');
        } else if (version === '1.2') {
            message = Buffer.from('\xFF\xFF\xFF\xFFgetservers 117 full empty', 'binary');
        } else if (version === '1.3') {
            message = Buffer.from('\xFF\xFF\xFF\xFFgetservers 118 full empty', 'binary');
        }
    } else if (game === 'cod4') {
        masterServer = 'cod4master.activision.com';
        masterPort = 20810 ;
        if (version === '1.0') {
            message = Buffer.from('\xFF\xFF\xFF\xFFgetservers 1 full empty', 'binary');
        } else if (version === '1.7') {
            message = Buffer.from('\xFF\xFF\xFF\xFFgetservers 6 full empty', 'binary');
        } else if (version === '1.8') {
            message = Buffer.from('\xFF\xFF\xFF\xFFgetservers 7 full empty', 'binary');
        }
    }
    

    if (!masterServer || !message) {
        callback(new Error('Invalid game/version'), null);
        return;
    }

    /*if (!masterServer || !message) {
        callback('Invalid game/version', null);
        return;
    } */

    const client = dgram.createSocket('udp4');

    client.send(message, 0, message.length, masterPort, masterServer, (err) => {
        if (err) {
            callback(err, null);
            client.close();
        }
    });

    client.on('message', (msg) => {
        const servers = [];
        const data = msg.toString('binary');
        const chunks = data.split('\\').slice(1);
        for (let chunk of chunks) {
            if (chunk.length === 6) {
                const ip = `${chunk.charCodeAt(0)}.${chunk.charCodeAt(1)}.${chunk.charCodeAt(2)}.${chunk.charCodeAt(3)}`; //gpt
                const port = chunk.charCodeAt(4) * 256 + chunk.charCodeAt(5); //gpt
                servers.push({ ip, port });
            }
        }
        console.log(`Total servers from ${game} ${version}:`, servers.length);
        client.close();
        callback(null, servers);
    });
}



function getServerStatus(ip, port, timeout = 1000) { // kinda
    return new Promise((resolve) => {
        const client = dgram.createSocket('udp4');
        const message = Buffer.from('\xFF\xFF\xFF\xFFgetstatus\n', 'binary');


        const timer = setTimeout(() => {
            client.close();
            resolve(null);
        }, timeout);

        client.send(message, 0, message.length, port, ip, (err) => {
            if (err) {
                clearTimeout(timer);
                client.close();
                resolve(null);
            }
        });

        client.on('message', (msg) => {
            clearTimeout(timer);
            client.close();

            const data = msg.toString();

            //console.log(data);
            const lines = data.split('\n');
            const varsLine = lines[1] || '';
            const vars = Object.fromEntries(varsLine.split('\\').slice(1).reduce((acc, val, i, arr) => {//gpt
                if (i % 2 === 0) acc.push([val, arr[i + 1]]);
                return acc;
            }, []));

            const players = lines.slice(2).filter(l => l.trim()).map(line => { //yep sure
                const match = line.match(/(\d+) (\d+) "(.*)"/); //bet
                return match ? { score: +match[1], ping: +match[2], name: match[3] } : null;
            }).filter(p => p).sort((a, b) => b.score - a.score);

            let extension = "Legacy";
            if (vars.codextended) extension = "CEx";
            else if (vars.libcod) extension = "LC1";
            else if (vars.vcodlib) extension = "VCL";
            else if (vars.iw1x) extension = "IW1x";

            if(!vars.sv_hostname) srvname = "Unnamed Server"; // servers that has blank name
            else srvname = cleanUnwantedTxt(vars.sv_hostname);

            let discordx = "None";
            for (let key in vars) {
                const cleanedValue = removeColorCodes(vars[key]);
                if (vars.hasOwnProperty(key)) {
                    if (cleanedValue.toLowerCase().includes('discord')) {
                        discordx = cleanedValue; // ????
                        break; 
                    }
                }
            }
                
            
            
            let websitex = "None";

            for (let key in vars) {
                if (vars.hasOwnProperty(key)) {
                    const cleanedKey = removeColorCodes(key).toLowerCase();
                    const cleanedValue = removeColorCodes(vars[key]);
            
                    if (cleanedKey.includes('website') || cleanedKey === 'web') {
                        websitex = cleanedValue;
                        break;
                    }
                }
            }
            
            let ownerx = "None";
            for (let key in vars) {
                if (vars.hasOwnProperty(key)) {
                    const cleanedKey = removeColorCodes(key).toLowerCase();
                    const cleanedValue = removeColorCodes(vars[key]);
            
                    if (cleanedKey.includes('owner') || cleanedKey === 'owners') {
                        ownerx = cleanedValue;
                        break;
                    }
                }
            }

            let email = "None";
            for (let key in vars) {
                if (vars.hasOwnProperty(key)) {
                    const cleanedKey = removeColorCodes(key).toLowerCase();
                    const cleanedValue = removeColorCodes(vars[key]);
            
                    if (cleanedKey.includes('email') || cleanedKey === 'mail') {
                        email = cleanedValue;
                        break;
                    }
                }
            }

            let contact = "None";
            for (let key in vars) {
                if (vars.hasOwnProperty(key)) {
                    const cleanedKey = removeColorCodes(key).toLowerCase();
                    const cleanedValue = removeColorCodes(vars[key]);
            
                    if (cleanedKey.includes('contact') || cleanedKey === 'contact') {
                        contact = cleanedValue;
                        break;
                    }
                }
            }
            if(email)
            {
                contact = email;
            } else {
                contact = contact;
            }

            resolve({
                ip, port,
                hostname: srvname || '',
                gametype: vars.g_gametype || '',
                mapname: vars.mapname || '',
                extensions: extension,
                clients: parseInt(vars.clients) || players.length,
                maxclients: vars.sv_maxclients || '',
                password: vars.pswrd,
                owner: ownerx,
                discord: discordx,
                website: websitex,

                protocol: vars.protocol,
                pure: vars.sv_pure,
                shortversion: vars.shortversion,
                contact: contact,

                players
            });
        });
    });
}




// AUUUUGGHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH CHATGPPPPPPPPPPPPPPPPPPPPPPPPPPPTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
async function getServerStatusWithRetry(ip, port, retries = 2, timeout = 1000) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        const result = await getServerStatus(ip, port, timeout);
        if (result) return result;
    }
    console.log(`Failed: ${ip}:${port}`);
    return null;
}

async function processInBatches(tasks, limit = 20) {
    const results = [];
    let i = 0;

    async function next() {
        if (i >= tasks.length) return;

        const task = tasks[i++];
        const result = await task();
        results.push(result);
        return next();
    }

    const workers = Array(limit).fill(null).map(() => next());
    await Promise.all(workers);
    return results;
}




/*app.get('/servers', async (req, res) => {
    getServersFromMaster(async (err, servers) => {
        if (err) return res.status(500).send("Master server failed");

        const limited = servers.slice(0, 99);
        const results = await Promise.all(limited.map(s => getServerStatus(s.ip, s.port)));

        const validServers = results.filter(s => s);
        validServers.sort((a, b) => b.clients - a.clients);

        const totalCount = validServers.length;
        const extensionCounts = validServers.reduce((acc, server) => {
            acc[server.extensions] = (acc[server.extensions] || 0) + 1;
            return acc;
        }, {});

        res.json({
            totalServers: totalCount,
            extensions: extensionCounts,
            servers: validServers
        });
    });
});*/
app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/unlock.png', async(req, res) => {
    res.sendFile(path.join(__dirname, "unlock.png"));
});

app.get('/lock.png', async(req, res) => {
    res.sendFile(path.join(__dirname, "lock.png"));
});
// IF ANY ERROR REMOVE THE /servers block and uncomment this
app.get('/servers', async (req, res) => {
    const game = req.query.game;
    const ver = req.query.ver;
    const hideempty = req.query.hideempty === 'true';
    const hidepass = req.query.hidepass === 'true';

    if (!game || !ver) {
        return res.status(400).send("Missing game or version parameters");
    }

    const key = gameKey(game, ver);
    const data = cachedData[key];

    if (!data) {  
        return res.status(404).send("No cached data for specified game/version");
    }

    // Apply filtering
    let servers = data.servers;

    if (hideempty) {
        servers = servers.filter(s => s.clients > 0);
    }
    if (hidepass) {
        servers = servers.filter(s => !s.password || s.password === '0');
    }

    res.json({
        lastUpdated: data.lastUpdated,
        totalServers: servers.length,
        extensions: data.extensions,
        servers
    });
});


app.get('/getstatus', async (req, res) => {
    const ip = req.query.ip;
    const port = req.query.port;

    if (!ip || !port) {
        return res.status(400).send("Missing ip or port parameters");
    }

    data = await getServerStatus(ip, port, 2000);
    

    if (!data) {
        return res.status(404).send("Cannot get server status");
    }


    res.json({
        data
    });
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
