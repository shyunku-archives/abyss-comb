const util = require('./util');

// 표준편차 값
function standardDeviation(values){
    let deviationSum = 0;
    let average = values.reduce((acc, cur) => (acc + cur), 0) / values.length;
    for(let value of values){
        deviationSum += Math.pow(value - average, 2);
    }

    return Math.sqrt(deviationSum / values.length);
}

module.exports = {
    calculate: function(gameData){
        // Team Score
        let myTeamScore, oppTeamScore = 0;

        let myTeamChampionIdList = gameData.gamers.my_team.map(e => e.championId);
        let oppTeamChampionIdList = gameData.gamers.opp_team.map(e => e.championId);

        let championCompactMap = util.readJson('./resources/compact/champions.json').data;

        let myTeamChampionInfoBundle = myTeamChampionIdList.map(e => championCompactMap[e]).map(e => {
            const {name, info, tags} = e;
            return {name, info, tags};
        });
        let oppTeamChampionInfoBundle = oppTeamChampionIdList.map(e => championCompactMap[e]).map(e => {
            const {name, info, tags} = e;
            return {name, info, tags};
        });

        // Stage 1 score
        let myTeamLightScore = standardDeviation(
            Object.values(
                myTeamChampionInfoBundle.reduce((acc, e) => {
                    let info = e.info;

                    acc.attack += info.attack;
                    acc.defense += info.defense;
                    acc.magic += info.magic;

                    return acc;
                }, {attack: 0, defense: 0, magic: 0})
            )
        );

        let oppTeamLightScore = standardDeviation(
            Object.values(
                oppTeamChampionInfoBundle.reduce((acc, e) => {
                    let info = e.info;

                    acc.attack += info.attack;
                    acc.defense += info.defense;
                    acc.magic += info.magic;

                    return acc;
                }, {attack: 0, defense: 0, magic: 0})
            )
        );



        myTeamScore = myTeamLightScore * 10;
        oppTeamScore = oppTeamLightScore * 10;

        myFinalScore = Math.pow(myTeamScore/(myTeamScore + oppTeamScore), 2);
        oppFinalScore = Math.pow(oppTeamScore/(myTeamScore + oppTeamScore), 2);

        return {
            my: myTeamScore,
            opp: oppTeamScore,
            prob: myFinalScore / (myFinalScore + oppFinalScore)
        };
    },
    test: function(id1, c1, id2, c2){
        let myTeamScore, oppTeamScore = 0;

        let championCompactMap = util.readJson('./resources/compact/champions.json').data;

        let myTeamChampionInfoBundle = c1.map(e => championCompactMap[e]).map(e => {
            const {name, info, tags} = e;
            return {name, info, tags};
        });
        let oppTeamChampionInfoBundle = c2.map(e => championCompactMap[e]).map(e => {
            const {name, info, tags} = e;
            return {name, info, tags};
        });

        // Stage 1 score
        let myTeamLightScore = standardDeviation(
            Object.values(
                myTeamChampionInfoBundle.reduce((acc, e) => {
                    let info = e.info;

                    acc.attack += info.attack;
                    acc.defense += info.defense;
                    acc.magic += info.magic;

                    return acc;
                }, {attack: 0, defense: 0, magic: 0})
            )
        );

        let oppTeamLightScore = standardDeviation(
            Object.values(
                oppTeamChampionInfoBundle.reduce((acc, e) => {
                    let info = e.info;

                    acc.attack += info.attack;
                    acc.defense += info.defense;
                    acc.magic += info.magic;

                    return acc;
                }, {attack: 0, defense: 0, magic: 0})
            )
        );



        myTeamScore = myTeamLightScore * 10;
        oppTeamScore = oppTeamLightScore * 10;

        myFinalScore = Math.pow(myTeamScore/(myTeamScore + oppTeamScore), 2);
        oppFinalScore = Math.pow(oppTeamScore/(myTeamScore + oppTeamScore), 2);

        return {
            [id1]: myFinalScore / (myFinalScore + oppFinalScore),
            [id2]: oppFinalScore / (myFinalScore + oppFinalScore)
        };
    }
};