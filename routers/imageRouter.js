const express = require('express');
const router = express.Router();
const fs = require('fs');
const util = require('../util');
const path = require('path');

router.get('/champion/:id', (req, res) => {
    let {id} = req.params;

    let compactChampionData = path.resolve(__dirname, '..', 'resources', 'compact', 'champions.json');

    let championData = util.readJson(compactChampionData);
    let championMap = championData.data;
    let championName = championMap[id].id;

    let imagePath = path.resolve(__dirname, '..', 'resources', 'dragonTrails', 'champion', `${championName}.png`);
    res.sendFile(imagePath);
});

router.get('/profileIcon/:id', (req, res) => {
    let {id} = req.params;

    let imagePath = path.resolve(__dirname, '..', 'resources', 'dragonTrails', 'profileicon', `${id}.png`);
    res.sendFile(imagePath);
});

router.get('/spell/:id', (req, res) => {
    let {id} = req.params;

    let imagePath = path.resolve(__dirname, '..', 'resources', 'images', 'spells', `${id}.png`);
    res.sendFile(imagePath);
});

module.exports = router;