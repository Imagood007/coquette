"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUEST_DB = void 0;
exports.getQuestData = getQuestData;
exports.QUEST_DB = {
    '1432436088508780675': { name: 'R.E.P.O. Monster', duration: 960 },
    '1436125144404725770': { name: 'Download Comet Browser', duration: 960 },
    '1439764528715010058': { name: 'New Season Ahsarah', duration: 960 },
    '1440059727005614090': { name: 'Opera GX', duration: 42 },
    '1418350811687419914': { name: 'The Power of Nitro', duration: 24 },
    '1425677992721514516': { name: 'Battlefield 6 Launch', duration: 960 },
    '1432424574561026070': { name: 'Dance with a Demon', duration: 960 },
    '1435391191834165398': { name: 'ABI Red Drops Fest', duration: 960 },
    '1437518140476100638': { name: 'Marvel Rivals S5.0', duration: 960 },
    '1431027486506094623': { name: 'Amazon Luna', duration: 29 },
    '1428083229587669155': { name: 'Bloons TD 6 Dart Monkey', duration: 960 },
    '1502164508033155162': { name: 'Where Winds Meet Ver 1.6 Qinchuan', duration: 960 },
    '1502102122492071958': { name: 'Where Winds Meet Ver 1.6 Qinchuan', duration: 960 },
    '1428459919212019874': { name: 'Crimson Desert', duration: 29 },
    '1435016951251603496': { name: 'Courtroom Chaos', duration: 75 },
    '1421275302923079721': { name: 'Space Marine 2 Free Demo', duration: 960 },
    '1435012985872715946': { name: 'Anno 117', duration: 158 },
    '1432205768106705070': { name: 'Battlefield REDSEC', duration: 960 },
    '1435367355759726642': { name: 'King of Meat Sale', duration: 29 },
    '1436481141711442101': { name: 'Where Winds Meet Launch', duration: 960 },
    '1430279721777762495': { name: 'PvZ Replanted', duration: 960 },
    '1432798014786764871': { name: 'Honkai: Star Rail', duration: 960 },
    '1410358070831480904': { name: 'Mobile Orbs Intro', duration: 31 },
    '1428139680477614150': { name: 'ARC Raiders', duration: 91 },
    '1432410015721062480': { name: 'ARC Raiders', duration: 960 },
    '1427820398283722833': { name: 'Painkiller', duration: 99 },
    '1427811805065121875': { name: 'Battlefield 6 on PS5 Video', duration: 29 },
    '1435777559475257428': { name: 'Amazon', duration: 29 },
    '1422714633357103315': { name: "Monopoly at McD's", duration: 96 },
    '1435324548827451605': { name: 'GO Wild Area 2025', duration: 29 },
    '1437537235133005914': { name: 'Call of Duty: Black Ops 7', duration: 960 },
    '1438202046804136028': { name: 'Microsoft Edge', duration: 29 },
    '1428092429030129755': { name: 'Chainsaw Man Movie', duration: 61 },
    '1434969640194539610': { name: 'Dinkum on Switch', duration: 89 },
    '1438642430571315290': { name: 'Alloyed Collective Gupdoption', duration: 960 },
    '1433219183411462265': { name: 'Palworld Collab', duration: 960 },
    '1435003145339273317': { name: 'The Running Man', duration: 148 },
    '1433542422268350574': { name: 'Firefox', duration: 19 },
    '1430258734113755247': { name: 'Jurassic World Rebirth', duration: 29 },
    '1432770475590684784': { name: 'Fortnite Discord', duration: 960 },
    '1438303745166409840': { name: 'EVE Online Video', duration: 89 },
    '1425291943302398073': { name: 'Discord Halloween 2025', duration: 22 },
    '1427829905323724922': { name: 'Bugonia', duration: 114 },
    '1463558755621929219': { name: 'One Piece Gachapon', duration: 960 },
    '1475943803956232283': { name: 'VALORANT Masters Santiago', duration: 960 },
    '1480604391718256773': { name: 'Version Update: Tangtang', duration: 960 },
};
function getQuestData(quest) {
    const questId = quest.id || quest.config?.id || 'unknown';
    const name = exports.QUEST_DB[questId]?.name ?? quest.config?.messages?.quest_name?.trim() ?? String(questId);
    const duration = exports.QUEST_DB[questId]?.duration ?? 900;
    let reward = 'Unknown';
    const rewards = quest.config?.rewards_config?.rewards;
    if (rewards && rewards.length > 0) {
        if (rewards[0].messages?.name)
            reward = rewards[0].messages.name;
        else if (rewards[0].orb_quantity)
            reward = `${rewards[0].orb_quantity} Orbs`;
    }
    return { name, duration, reward };
}
