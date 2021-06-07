const express = require('express');
const app = express();
const pbip = require('public-ip');
const util = require('./util');
const fs = require('fs');
const axios = require('axios');

let ip;
const port = 6400;

app.listen(port, async() => {
    ip = await pbip.v4();
    console.log(`Server opened at ${ip}:${port}`);
});

app.all('/*', (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type");
    next();
});
app.use(express.json());
app.use(express.static(__dirname + '/resources'));
app.use(express.urlencoded( {extended : false } ));

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/summonerId', (req, res) => {
    let {name} = req.query;

    util.riot(`/lol/summoner/v4/summoners/by-name/${name}`, (success, data) => {
        res.send(data);
    });
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
                            let {championId, summonerName, summonerId, teamId} = entity;
                            if(!participantsData.hasOwnProperty(teamId)){
                                participantsData[teamId] = [];
                            }
                            participantsData[teamId].push({championId, summonerName, summonerId});
                        });

                        Object.keys(participantsData).map(teamId => {
                            let participantList = participantsData[teamId];
                            let isOurTeam = participantList.find(e => e.summonerId === summonerId);
                            let key = isOurTeam ? 'my_team' : 'opp_team';

                            gameData.gamers[key] = participantList;
                        });

                        let getMapType = util.getGameType(gameQueueConfigId);

                        res.render('ingame', {
                            summonerName,
                            summonerLevel,
                            profileIconId,
                            dataDragonVersion: global.dataDragonLatestVersion,
                            gameData,
                            getMapType
                        });
                    }else{
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
                }
            });

            // champions info update
            util.axios(dataDragonUrl + '/data/ko_KR/champion.json', (success, data) => {
                if(success){
                    let stringifiedData = JSON.stringify(data, null, 4);
                    fs.writeFileSync('./resources/datafiles/champions.json', stringifiedData);
                }
            });

            // download dragontails data (images bundle)
            util.getDragonTrailTgz(newDataDragonVersion);
        }else{
            console.error("Data Dragon not responding!", data);
        }
    });
}, 1000 * 1800);