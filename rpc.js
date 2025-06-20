const fs = require("fs");
const path = require("path");
const { SlippiGame } = require("@slippi/slippi-js");
const RPC = require("discord-rpc");
const os = require('os');

const startNow = new Date();
const yearMonth = `${startNow.getFullYear()}-${String(startNow.getMonth() + 1).padStart(2, '0')}`;

const characterIdToName = {
    0: "mario",
    1: "fox",
    2: "captain_falcon",
    3: "donkey_kong",
    4: "kirby",
    5: "bowser",
    6: "link",
    7: "sheik",
    8: "ness",
    9: "peach",
    10: "popo",
    11: "nana",
    12: "pikachu",
    13: "samus",
    14: "yoshi",
    15: "jigglypuff",
    16: "mewtwo",
    17: "luigi",
    18: "marth",
    19: "zelda",
    20: "young_link",
    21: "dr_mario",
    22: "falco",
    23: "pichu",
    24: "ganondorf",
    25: "roy",
    26: "master_hand",
    27: "crazy_hand",
    28: "wire_frame_male",
    29: "wire_frame_female",
    30: "giga_bowser",
    31: "sandbag"
};

const REPLAYS_DIR = path.join(
    process.env.USERPROFILE,
    "Documents",
    "Slippi",
    yearMonth
);

const DISCORD_CLIENT_ID = "1381760940973756476";

// poll once each second to prevent rate limiting
const POLL_INTERVAL = 1000;

let currentGame = null;
let currentReplayPath = null;
const rpc = new RPC.Client({ transport: "ipc" });

function getAppDataPath() {
    const platform = process.platform;

    if (platform === 'win32') {
        return process.env.APPDATA;
    } else if (platform === 'darwin') {
        // macos: typically ~/Library/Application Support
        return path.join(os.homedir(), 'Library', 'Application Support');
    } else {
        // linux/unix: typically ~/.config
        return path.join(os.homedir(), '.config');
    }
}
function getConnectCode() {
    const slippiPath = path.join(
        getAppDataPath(),
        'Slippi Launcher',
        'netplay',
        'User',
        'Slippi',
        'user.json'
    );

    try {
        const rawData = fs.readFileSync(slippiPath, 'utf8');
        const jsonData = JSON.parse(rawData);
        const connectCode = jsonData.connectCode;

        console.log('Connect Code:', connectCode);
        return connectCode;
    } catch (err) {
        console.error('Failed to read connect code:', err);
        return null;
    }
}

let userConnectCode = getConnectCode();

// capitalizes words, changes underscores to spaces
function formatName(input) {
    return input
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// doesnt always do what's intended by only showing live games
/*function getLatestReplayFile() {
    const files = fs
        .readdirSync(REPLAYS_DIR)
        .filter((f) => f.endsWith(".slp"))
        .map((f) => ({
            name: f,
            time: fs.statSync(path.join(REPLAYS_DIR, f)).mtimeMs,
        }))
        .sort((a, b) => b.time - a.time);

    return files.length > 0 ? path.join(REPLAYS_DIR, files[0].name) : null;
}*/
// attempt at getting only active slippi files
function getLatestReplayFile() {
    const files = fs
        .readdirSync(REPLAYS_DIR)
        .filter((f) => f.endsWith(".slp"))
        .map((f) => ({
            name: f,
            time: fs.statSync(path.join(REPLAYS_DIR, f)).mtimeMs,
        }))
        .sort((a, b) => b.time - a.time);

    const now = Date.now();

    if (files.length === 0) return null;

    const latest = files[0];
    const ageMs = now - latest.time;

    return ageMs <= 10000 ? path.join(REPLAYS_DIR, latest.name) : null;
}

function getCharacterAssetKey(characterName) {
	// map character names to discord assets
    return characterName.toLowerCase().replace(/ /g, "_");
}

function updatePresence(game) {

    const settings = game.getSettings();
    // const metadata = game.getMetadata();
    const frame = game.getLatestFrame();

    if (!settings || !frame) return;

    // 0 is human, 1 is ai
    const players = settings.players;

    // the code commented below was used in the past to only get human players
    //settings.players.filter((p) => p.type === 0);

    //const player = players[0];
    //const opponent = players[1];

    //console.log(`${userConnectCode}`);
    //console.log("Player types:", settings.players.map(p => p.connectCode));

    const player = players.find(p => p.connectCode === userConnectCode) ?? players[0];
    const opponent = players.find(p => p !== player) ?? players[1];

    //console.log(`PlYou: ${player.characterId} | PlOpp: ${opponent.characterId}`);

    const playerStocks = frame.players[player.playerIndex].post?.stocksRemaining ?? "?";
    const oppStocks = frame.players[opponent.playerIndex].post?.stocksRemaining ?? "?";

    // console.log("Player types:", frame.players.map(p => p.post.stocksRemaining));
    // console.log(`You: ${playerStocks} | Opp: ${oppStocks}`);

    const youCharacter = frame.players[player.playerIndex].post.internalCharacterId;
    const opponentCharacter = frame.players[opponent.playerIndex].post.internalCharacterId;

    // convert and use assets
    const youCharacterName = characterIdToName[youCharacter];
    const oppCharacterName = characterIdToName[opponentCharacter];
    const youCharacterAsset = getCharacterAssetKey(youCharacterName);

    // shows opponent as character name instead of their username
    const youName = players[player.playerIndex]?.displayName ?? formatName(youCharacterName);
    const opponentName = players[opponent.playerIndex]?.displayName ?? formatName(oppCharacterName);

    //console.log(`opponentCharacter: ${characterIdToName[opponentCharacter]}`);
    //console.log(`you: ${characterIdToName[youCharacter]}`);

    rpc.setActivity({
        details: `vs ${opponentName} (${formatName(oppCharacterName)})`,
        state: `${youName}: ${playerStocks} stock(s) | ${opponentName}: ${oppStocks} stock(s)`,
        largeImageKey: "ssbm",
        largeImageText: "NTSC v1.02",
        smallImageKey: youCharacterAsset,
        smallImageText: `Playing as ${formatName(youCharacterName)}`,
        instance: false,
    });
}

// recursively call each second (POLL_INVERVAL) and find replays/update RPC
function startPolling() {
    setInterval(() => {
        const latest = getLatestReplayFile();

        
        if (!currentReplayPath) {
            rpc.setActivity({
                details: `No active game`,
                largeImageKey: "ssbm",
                largeImageText: "NTSC v1.02",
                instance: false,
            });
        }
        

        if (!latest || latest === currentReplayPath) {
            if (currentGame) updatePresence(currentGame);
            return;
        }

        currentReplayPath = latest;
        console.log("New replay detected:", latest);
        currentGame = new SlippiGame(currentReplayPath, { processOnTheFly: true });
    }, POLL_INTERVAL);
}

console.log('Attmepting to connect to discord...');

rpc.on("ready", () => {
    console.log("Connected to Discord RPC.");
    startPolling();
});

rpc.login({ clientId: DISCORD_CLIENT_ID }).catch(console.error);
