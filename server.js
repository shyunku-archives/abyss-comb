const express = require('express');
const app = express();
const pbip = require('public-ip');
const util = require('./util');
const fs = require('fs');
const core = require('./core');
const axios = require('axios');

const imageRouter = require('./routers/imageRouter');

let ip;
const port = 6400;

app.listen(port, async() => {
    ip = await pbip.v4();
    console.log(`Server opened at ${ip}:${port}`);
});

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.all('/*', (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type");
    next();
});
app.use(express.json());
app.use(express.static(__dirname + '/static'));
app.use(express.urlencoded( {extended : false } ));

app.use('/image', imageRouter);

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/summonerId', (req, res) => {
    let {name} = req.query;

    util.riot(`/lol/summoner/v4/summoners/by-name/${name}`, (success, data) => {
        res.send(data);
    });
});

app.get('/validate', (req, res) => {
    let {name} = req.query;
    let encodedSummonerName = encodeURIComponent(name);
    let summonerId;

    try{
        util.riot(`/lol/summoner/v4/summoners/by-name/${encodedSummonerName}`, (success, data) => {
            if(success){
                let puuid = data.puuid;
                let accountId = data.accountId;
                let summonerName = data.name;
                let {summonerLevel, profileIconId} = data;
                summonerId = data.id;


                util.riot(`/lol/match/v4/matchlists/by-account/${accountId}?endIndex=30`, async (success, data) => {
                    let gameIdList = data.matches.map(e => e.gameId);
                    let games = {};

                    for(let id of gameIdList){
                        let resp = await util.riotSync(`/lol/match/v4/matches/${id}`);
                        let champions = resp.data.participants.reduce((acc, p) => {
                            if(!acc.hasOwnProperty(p.teamId)){acc[p.teamId] = [];}
                            acc[p.teamId].push(p.championId);

                            return acc;
                        }, {});

                        let keys = Object.keys(champions);
                        let data2 = core.test(keys[0], champions[keys[0]], keys[1], champions[keys[1]]);
                        
                        let win = resp.data.teams.filter(t => t.win === 'Win')[0].teamId;
                        let expect = data2[keys[0]] > data2[keys[1]] ? 100 : 200;

                        games[id] = {
                            correct: win === expect,
                            winTeam: win,
                            expectWin: expect,
                            weight: Math.max(data2[keys[0]], data2[keys[1]])
                        }
                    }

                    res.send(games);
                });
            }
        });
    }catch(e){
        console.error(e);
    }
});

app.get('/judge', (req, res) => {
    let {name} = req.query;
    let encodedSummonerName = encodeURIComponent(name);
    let summonerId;

    try{
        util.riot(`/lol/summoner/v4/summoners/by-name/${encodedSummonerName}`, (success, data) => {
            if(success){
                let puuid = data.puuid;
                let accountId = data.accountId;
                let summonerName = data.name;
                let {summonerLevel, profileIconId} = data;
                summonerId = data.id;

                util.riot(`/lol/spectator/v4/active-games/by-summoner/${summonerId}`, (success, data) => {
                    if(success){
                        // currently gaming
                        let {participants, gameId, gameMode, gameQueueConfigId} = data;
                        let participantsData = {};
                        let gameData = {
                            gameId, gameMode,
                            gamers: {}
                        };

                        participants.map(entity => {
                            let {championId, summonerName, summonerId, teamId, spell1Id, spell2Id} = entity;
                            if(!participantsData.hasOwnProperty(teamId)){
                                participantsData[teamId] = [];
                            }
                            participantsData[teamId].push({championId, summonerName, summonerId, spell1Id, spell2Id});
                        });

                        Object.keys(participantsData).map(teamId => {
                            let participantList = participantsData[teamId];
                            let isOurTeam = participantList.find(e => e.summonerId === summonerId);
                            let key = isOurTeam ? 'my_team' : 'opp_team';

                            gameData.gamers[key] = participantList;
                        });

                        let getMapType = util.getGameType(gameQueueConfigId);

                        score = core.calculate(gameData);

                        res.render('ingame', {
                            summonerName,
                            summonerId,
                            summonerLevel,
                            profileIconId,
                            dataDragonVersion: global.dataDragonLatestVersion,
                            gameData,
                            getMapType,
                            score
                        });
                    }else{
                        if(!data.response){
                            console.error(data);
                            return;
                        }

                        let {status, statusText} = data.response;
                        console.log(status, statusText);
                
                        switch(status){
                            case 404:
                                res.send(`${name} is not gaming.`);
                                break;
                            default:
                                res.send(data);
                                break;
                        }
                    }
                });
            }else{
                let {status, statusText} = data.response;
        
                switch(status){
                    case 404:
                        res.send(`${name} doesn't exists.`);
                        break;
                    default:
                        res.send(data);
                        break;
                }
            }
        });
    }catch(e){
        console.error(e);
    }
});

// per 30 minutes (update)
global.dataDragonLatestVersion = '0.0.0';
util.fastInterval(() => {
    // update data dragons
    util.axios(`https://ddragon.leagueoflegends.com/api/versions.json`, async (success, data) => {
        if(success){
            let newDataDragonVersion = data[0];

            if(global.dataDragonLatestVersion === newDataDragonVersion) return;
            console.log(`Data Dragon version updated ${global.dataDragonLatestVersion} -> ${newDataDragonVersion}`);
            global.dataDragonLatestVersion = newDataDragonVersion;
            
            let dataDragonUrl = "https://ddragon.leagueoflegends.com/cdn/" + global.dataDragonLatestVersion;

            // item info update
            util.axios(dataDragonUrl + '/data/ko_KR/item.json', (success, data) => {
                if(success){
                    let stringifiedData = JSON.stringify(data, null, 4);
                    fs.writeFileSync('./resources/datafiles/items.json', stringifiedData);
                }
            });

            // perks info update
            util.axios('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perks.json', (success, data) => {
                if(success){
                    let stringifiedData = JSON.stringify(data, null, 4);
                    fs.writeFileSync('./resources/datafiles/perks.json', stringifiedData);
                }
            });

            // runes info update
            util.axios(dataDragonUrl + '/data/ko_KR/runesReforged.json', (success, data) => {
                if(success){
                    let stringifiedData = JSON.stringify(data, null, 4);
                    fs.writeFileSync('./resources/datafiles/runes.json', stringifiedData);
                }
            });

            // spells info update
            util.axios(dataDragonUrl + '/data/ko_KR/summoner.json', (success, data) => {
                if(success){
                    let stringifiedData = JSON.stringify(data, null, 4);
                    fs.writeFileSync('./resources/datafiles/spells.json', stringifiedData);

                    let compact = {}, spellDataBundle = data.data;
                    compact['version'] = data['version'];
                    
                    compact['data'] = Object.keys(spellDataBundle).reduce((acc, spellName) => {
                        let spellData = spellDataBundle[spellName];
                        let {id, key, name} = spellData;

                        acc[spellData.key] = {
                            id, key, name
                        };

                        return acc;
                    }, {});

                    
                    let stringifiedCompactData = JSON.stringify(compact, null, 4);
                    fs.writeFileSync('./resources/compact/spells.json', stringifiedCompactData);

                    Object.values(compact.data).map(spellInfo => {
                        let id = spellInfo.id;
                        let path = dataDragonUrl + `/img/spell/${id}.png`;

                        util.downloadImage(path, `./resources/images/spells/${spellInfo.key}.png`);
                    });
                }
            });

            // champions info update
            util.axios(dataDragonUrl + '/data/ko_KR/champion.json', (success, data) => {
                if(success){
                    let stringifiedData = JSON.stringify(data, null, 4);
                    fs.writeFileSync('./resources/datafiles/champions.json', stringifiedData);

                    let compact = {}, championDataBundle = data.data;
                    compact['version'] = data['version'];
                    
                    compact['data'] = Object.keys(championDataBundle).reduce((acc, championName) => {
                        let championData = championDataBundle[championName];
                        let {id, key, name, info, image, tags, stats} = championData;

                        acc[championData.key] = {
                            id, key, name, info, image, tags, stats
                        };

                        return acc;
                    }, {});

                    let stringifiedCompactData = JSON.stringify(compact, null, 4);
                    fs.writeFileSync('./resources/compact/champions.json', stringifiedCompactData);
                }
            });

            // download dragontails data (images bundle)
            util.getDragonTrailTgz(newDataDragonVersion);
        }else{
            console.error("Data Dragon not responding!", data);
        }
    });
}, 1000 * 1800);