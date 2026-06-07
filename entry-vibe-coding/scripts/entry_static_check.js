#!/usr/bin/env node
'use strict';

const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseArgs, printOrWriteJson, SPEEDS } = require('./entry_cdp_lib');

const SAFE_ENTRY_FUNCTIONS = new Set([
    'move_to_direction',
]);

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}

function isDataUrl(value) {
    return typeof value === 'string' && value.startsWith('data:');
}

function dataUrlBytes(value) {
    const comma = value.indexOf(',');
    if (comma === -1) {
        return 0;
    }
    const meta = value.slice(0, comma);
    const body = value.slice(comma + 1);
    if (meta.includes(';base64')) {
        return Math.floor(body.length * 3 / 4);
    }
    return Buffer.byteLength(decodeURIComponent(body), 'utf8');
}

function checkProject(project, errors, warnings) {
    if (!project || typeof project !== 'object' || Array.isArray(project)) {
        errors.push('Project must be a JSON object.');
        return;
    }
    if (project.speed !== undefined && !SPEEDS.includes(Number(project.speed))) {
        warnings.push(`Project speed ${project.speed} is outside the verified Entry speed list ${SPEEDS.join(', ')}.`);
    }

    for (const key of ['scenes', 'objects', 'variables', 'messages', 'functions', 'tables']) {
        if (project[key] !== undefined && !Array.isArray(project[key])) {
            errors.push(`project.${key} must be an array.`);
        }
    }

    const scenes = Array.isArray(project.scenes) ? project.scenes : [];
    const objects = Array.isArray(project.objects) ? project.objects : [];
    const sceneIds = new Set();
    for (const scene of scenes) {
        if (!scene.id) {
            errors.push('Scene is missing id.');
        } else if (sceneIds.has(scene.id)) {
            errors.push(`Duplicate scene id: ${scene.id}`);
        }
        sceneIds.add(scene.id);
    }

    const objectIds = new Set();
    for (const object of objects) {
        if (!object.id) {
            errors.push(`Object "${object.name || '<unnamed>'}" is missing id.`);
        } else if (objectIds.has(object.id)) {
            errors.push(`Duplicate object id: ${object.id}`);
        }
        objectIds.add(object.id);

        if (object.scene && sceneIds.size && !sceneIds.has(object.scene)) {
            errors.push(`Object ${object.id} references missing scene ${object.scene}.`);
        }
        if (!object.objectType) {
            warnings.push(`Object ${object.id || object.name} is missing objectType.`);
        }

        const entity = object.entity || {};
        for (const field of ['x', 'y', 'width', 'height']) {
            if (entity[field] !== undefined && typeof entity[field] !== 'number') {
                errors.push(`Object ${object.id} entity.${field} must be numeric.`);
            }
        }

        const pictures = object.sprite?.pictures || [];
        if (object.objectType === 'sprite' && pictures.length === 0) {
            errors.push(`Sprite ${object.id} has no pictures.`);
        }
        const pictureIds = new Set(pictures.map((picture) => picture.id));
        if (pictures.length && object.selectedPictureId && !pictureIds.has(object.selectedPictureId)) {
            errors.push(`Object ${object.id} selectedPictureId ${object.selectedPictureId} is not in sprite.pictures.`);
        }
        for (const picture of pictures) {
            if (!picture.id || !picture.name || !picture.fileurl) {
                errors.push(`Object ${object.id} has a picture missing id, name, or fileurl.`);
            }
            if (picture.dimension) {
                for (const field of ['width', 'height']) {
                    if (typeof picture.dimension[field] !== 'number') {
                        warnings.push(`Picture ${picture.id} dimension.${field} is not numeric.`);
                    }
                }
            }
            if (isDataUrl(picture.fileurl) && dataUrlBytes(picture.fileurl) > 5 * 1024 * 1024) {
                warnings.push(`Picture ${picture.id} is embedded and exceeds the 5 MB object upload guideline.`);
            }
        }

        for (const sound of object.sprite?.sounds || []) {
            const ext = String(sound.ext || sound.name || '').toLowerCase();
            if (ext && !ext.endsWith('.mp3') && !ext.endsWith('.wav') && !ext.endsWith('.ogg')) {
                warnings.push(`Sound ${sound.id || sound.name} extension is not a commonly safe browser audio type.`);
            }
            if (isDataUrl(sound.fileurl) && dataUrlBytes(sound.fileurl) > 10 * 1024 * 1024) {
                warnings.push(`Sound ${sound.id || sound.name} is embedded and exceeds the 10 MB upload guideline.`);
            }
        }
    }
}

function checkPython(source, project, strictEntryApi, errors, warnings) {
    if (!source) {
        return;
    }
    if (!/\bimport\s+Entry\b/.test(source)) {
        warnings.push('Entry Python source does not include "import Entry".');
    }
    if (!source.startsWith('# Entrybot object Python code')) {
        warnings.push('Entry Python source does not start with the verified default header comment. Entry Filbert parsing is more reliable with the header.');
    }
    if (!/\bdef\s+when_[a-zA-Z0-9_]+\s*\(/.test(source)) {
        warnings.push('Entry Python source has no when_* event function.');
    }

    const dir = mkdtempSync(join(tmpdir(), 'entry-pycheck-'));
    const file = join(dir, 'main.py');
    try {
        writeFileSync(file, source, 'utf8');
        const result = spawnSync('python', ['-m', 'py_compile', file], { encoding: 'utf8' });
        if (result.error) {
            warnings.push(`Python syntax check skipped: ${result.error.message}`);
        } else if (result.status !== 0) {
            errors.push(`Python syntax check failed: ${(result.stderr || result.stdout).trim()}`);
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }

    const functions = [...source.matchAll(/\bEntry\.([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)].map((match) => match[1]);
    for (const fn of functions) {
        if (!SAFE_ENTRY_FUNCTIONS.has(fn)) {
            const message = `Entry.${fn} is not in this skill's verified safe Entry Python allowlist. Confirm against the live block palette.`;
            if (strictEntryApi) {
                errors.push(message);
            } else {
                warnings.push(message);
            }
        }
    }

    const objectNames = new Set((project?.objects || []).map((object) => object.name).filter(Boolean));
    for (const match of source.matchAll(/["']([^"']{2,40})["']/g)) {
        const value = match[1];
        if (/object|sprite|scene/i.test(value) && !objectNames.has(value)) {
            warnings.push(`String "${value}" looks like an object/scene reference but does not match an object name.`);
        }
    }
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const errors = [];
    const warnings = [];
    const project = args.project ? readJson(args.project) : null;
    const pythonSource = args.python ? readFileSync(args.python, 'utf8') : '';

    if (!project && !pythonSource) {
        throw new Error('Pass --project <project.json>, --python <main.py>, or both.');
    }
    if (project) {
        checkProject(project, errors, warnings);
    }
    checkPython(pythonSource, project, Boolean(args['strict-entry-api']), errors, warnings);

    const report = {
        ok: errors.length === 0,
        errors,
        warnings,
        checked: {
            project: args.project || null,
            python: args.python || null,
            strictEntryApi: Boolean(args['strict-entry-api']),
        },
    };
    printOrWriteJson(report, args.out);
    if (!report.ok) {
        process.exitCode = 1;
    }
}

main();
