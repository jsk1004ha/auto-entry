#!/usr/bin/env node
'use strict';

const { readFileSync, writeFileSync, statSync } = require('node:fs');
const { basename, extname } = require('node:path');
const { parseArgs, printOrWriteJson, summarizeProject } = require('./entry_cdp_lib');

const MIME = {
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.bmp': 'image/bmp',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
};

function listArg(value) {
    if (!value) {
        return [];
    }
    return String(value).split(/[;,]/).map((item) => item.trim()).filter(Boolean);
}

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}

function minimalProject() {
    return {
        speed: 60,
        objects: [],
        variables: [],
        messages: [],
        functions: [],
        scenes: [{ id: 'scene1', name: 'Scene 1' }],
        interface: {},
        tables: [],
        expansionBlocks: [],
        aiUtilizeBlocks: [],
        hardwareLiteBlocks: [],
    };
}

function allIds(project) {
    const ids = new Set((project.scenes || []).map((item) => item.id).filter(Boolean));
    for (const object of project.objects || []) {
        if (object.id) ids.add(object.id);
        for (const picture of object.sprite?.pictures || []) {
            if (picture.id) ids.add(picture.id);
        }
        for (const sound of object.sprite?.sounds || []) {
            if (sound.id) ids.add(sound.id);
        }
    }
    return ids;
}

function nextId(ids, prefix) {
    let i = 1;
    while (ids.has(`${prefix}${i}`)) {
        i++;
    }
    const id = `${prefix}${i}`;
    ids.add(id);
    return id;
}

function getDimensions(path, buffer) {
    const ext = extname(path).toLowerCase();
    if (ext === '.png' && buffer.length > 24) {
        return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (ext === '.bmp' && buffer.length > 26) {
        return { width: Math.abs(buffer.readInt32LE(18)), height: Math.abs(buffer.readInt32LE(22)) };
    }
    if (ext === '.svg') {
        const text = buffer.toString('utf8');
        const width = Number((text.match(/\bwidth=["']?([0-9.]+)/i) || [])[1]);
        const height = Number((text.match(/\bheight=["']?([0-9.]+)/i) || [])[1]);
        return {
            width: Number.isFinite(width) && width > 0 ? width : 100,
            height: Number.isFinite(height) && height > 0 ? height : 100,
        };
    }
    return { width: 100, height: 100 };
}

function dataUrl(path) {
    const ext = extname(path).toLowerCase();
    const mime = MIME[ext];
    if (!mime) {
        throw new Error(`Unsupported asset extension ${ext} for ${path}.`);
    }
    const buffer = readFileSync(path);
    return {
        url: `data:${mime};base64,${buffer.toString('base64')}`,
        ext,
        bytes: buffer.length,
        dimensions: getDimensions(path, buffer),
    };
}

function createObject(project, ids, name, scene) {
    const objectId = nextId(ids, 'obj');
    const object = {
        id: objectId,
        name,
        objectType: 'sprite',
        scene,
        lock: false,
        rotateMethod: 'free',
        selectedPictureId: null,
        script: '[]',
        sprite: { pictures: [], sounds: [] },
        entity: {
            x: 0,
            y: 0,
            regX: 50,
            regY: 50,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            direction: 90,
            width: 100,
            height: 100,
            visible: true,
        },
    };
    project.objects.push(object);
    return object;
}

function findOrCreateObject(project, ids, objectName) {
    if (!project.scenes?.length) {
        project.scenes = [{ id: 'scene1', name: 'Scene 1' }];
    }
    const scene = project.scenes[0].id;
    const wanted = String(objectName || '').trim();
    const found = wanted
        ? (project.objects || []).find((object) => object.id === wanted || object.name === wanted)
        : (project.objects || [])[0];
    return found || createObject(project, ids, wanted || 'Asset Object', scene);
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const project = args.project ? readJson(args.project) : minimalProject();
    project.objects = project.objects || [];
    const ids = allIds(project);
    const object = findOrCreateObject(project, ids, args.object);
    object.sprite = object.sprite || { pictures: [], sounds: [] };
    object.sprite.pictures = object.sprite.pictures || [];
    object.sprite.sounds = object.sprite.sounds || [];

    const added = { pictures: [], sounds: [] };
    for (const image of listArg(args.image || args.images)) {
        const asset = dataUrl(image);
        if (asset.bytes > 10 * 1024 * 1024) {
            throw new Error(`Image ${image} is larger than 10 MB.`);
        }
        const id = nextId(ids, 'pic');
        const name = basename(image, extname(image));
        const picture = {
            id,
            name,
            fileurl: asset.url,
            thumbUrl: asset.url,
            imageType: asset.ext === '.svg' ? 'svg' : 'bitmap',
            dimension: asset.dimensions,
        };
        object.sprite.pictures.push(picture);
        object.selectedPictureId = object.selectedPictureId || id;
        object.entity.width = asset.dimensions.width;
        object.entity.height = asset.dimensions.height;
        added.pictures.push({ id, name, bytes: asset.bytes, dimensions: asset.dimensions });
    }

    for (const soundPath of listArg(args.sound || args.sounds)) {
        const asset = dataUrl(soundPath);
        if (asset.bytes > 10 * 1024 * 1024) {
            throw new Error(`Sound ${soundPath} is larger than 10 MB.`);
        }
        const id = nextId(ids, 'sound');
        const name = basename(soundPath, extname(soundPath));
        object.sprite.sounds.push({
            id,
            name,
            fileurl: asset.url,
            duration: 0,
            ext: asset.ext,
            size: statSync(soundPath).size,
        });
        added.sounds.push({ id, name, bytes: asset.bytes });
    }

    if (args.out) {
        writeFileSync(args.out, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
    }
    printOrWriteJson({
        ok: true,
        object: { id: object.id, name: object.name },
        added,
        projectSummary: summarizeProject(project),
        out: args.out || null,
    }, args.report);
}

main();

