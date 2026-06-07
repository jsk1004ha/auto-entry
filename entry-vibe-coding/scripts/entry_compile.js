#!/usr/bin/env node
'use strict';

const { readFileSync, writeFileSync } = require('node:fs');
const { parseArgs, printOrWriteJson, summarizeProject } = require('./entry_cdp_lib');

const SPEEDS = [1, 15, 30, 45, 60];

function hasAny(text, words) {
    return words.some((word) => text.includes(word));
}

function safeName(value, fallback) {
    const text = String(value || '').trim();
    return text || fallback;
}

function svgDataUrl(label, color, shape = 'rect') {
    const escaped = String(label).slice(0, 18).replace(/[&<>"]/g, (ch) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
    })[ch]);
    const body = shape === 'circle'
        ? `<circle cx="60" cy="60" r="48" fill="${color}"/>`
        : `<rect x="14" y="14" width="92" height="92" rx="16" fill="${color}"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="#f8fafc"/>${body}<text x="60" y="66" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="#111827">${escaped}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function picture(id, name, color, shape) {
    const url = svgDataUrl(name, color, shape);
    return {
        id,
        name,
        fileurl: url,
        thumbUrl: url,
        imageType: 'svg',
        dimension: { width: 120, height: 120 },
    };
}

function sprite(id, name, scene, x, y, color, shape = 'rect') {
    const pictureId = `${id}_pic1`;
    return {
        id,
        name,
        objectType: 'sprite',
        scene,
        lock: false,
        rotateMethod: 'free',
        selectedPictureId: pictureId,
        script: '[]',
        sprite: {
            pictures: [picture(pictureId, `${name} idle`, color, shape)],
            sounds: [],
        },
        entity: {
            x,
            y,
            regX: 60,
            regY: 60,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            direction: 90,
            width: 120,
            height: 120,
            visible: true,
        },
    };
}

function variable(id, name, value) {
    return {
        id,
        name,
        value,
        variableType: 'variable',
        isCloud: false,
        visible: true,
        x: 12,
        y: 12,
        object: null,
        scene: null,
    };
}

function detectIntent(prompt) {
    const text = prompt.toLowerCase();
    const game = hasAny(text, ['game', 'score', '점수', '게임', '피하기', 'avoid', 'dodge', 'jump', '점프']);
    const quiz = hasAny(text, ['quiz', 'question', 'answer', '퀴즈', '문제', '정답']);
    const story = hasAny(text, ['story', 'animation', 'animate', '장면', '이야기', '애니', '만화']);
    const obstacle = hasAny(text, ['obstacle', 'hazard', 'enemy', '장애물', '적', '피하기']);
    const score = hasAny(text, ['score', 'point', '점수', '포인트']);
    const timer = hasAny(text, ['timer', 'time limit', '시간', '타이머']);
    const speed = SPEEDS.find((item) => text.includes(`${item}fps`) || text.includes(`${item} fps`)) || 60;
    return {
        type: quiz ? 'quiz' : game ? 'game' : story ? 'story' : 'animation',
        obstacle,
        score: score || game,
        timer,
        speed,
    };
}

function buildProject(prompt, options = {}) {
    const intent = detectIntent(prompt);
    const title = safeName(options.title, 'Entry Vibe Project');
    const scenes = intent.type === 'quiz'
        ? [
            { id: 'scene_intro', name: 'Intro' },
            { id: 'scene_question', name: 'Question' },
            { id: 'scene_result', name: 'Result' },
        ]
        : intent.type === 'story'
            ? [
                { id: 'scene_start', name: 'Start' },
                { id: 'scene_middle', name: 'Middle' },
                { id: 'scene_end', name: 'End' },
            ]
            : [{ id: 'scene1', name: 'Scene 1' }];

    const scene = scenes[0].id;
    const objects = [];
    if (intent.type === 'quiz') {
        objects.push(sprite('obj_question', 'Question', 'scene_question', 0, 60, '#38bdf8'));
        objects.push(sprite('obj_choice_a', 'Choice A', 'scene_question', -110, -55, '#22c55e'));
        objects.push(sprite('obj_choice_b', 'Choice B', 'scene_question', 110, -55, '#f97316'));
    } else if (intent.type === 'story') {
        objects.push(sprite('obj_actor', 'Actor', scene, -120, -10, '#8b5cf6', 'circle'));
        objects.push(sprite('obj_prop', 'Prop', scene, 120, -10, '#f59e0b'));
    } else {
        objects.push(sprite('obj_player', 'Player', scene, -160, -20, '#2563eb', 'circle'));
        objects.push(sprite('obj_goal', 'Goal', scene, 165, -20, '#16a34a'));
        if (intent.obstacle) {
            objects.push(sprite('obj_hazard', 'Hazard', scene, 0, -20, '#dc2626'));
        }
        if (intent.score) {
            objects.push(sprite('obj_score_label', 'Score', scene, -190, 100, '#facc15'));
        }
    }

    const variables = [];
    if (intent.score) {
        variables.push(variable('var_score', 'score', 0));
    }
    if (intent.timer) {
        variables.push(variable('var_timer', 'timer', 30));
    }

    return {
        project: {
            speed: intent.speed,
            objects,
            variables,
            messages: [],
            functions: [],
            scenes,
            interface: { title },
            tables: [],
            expansionBlocks: [],
            aiUtilizeBlocks: [],
            hardwareLiteBlocks: [],
        },
        intent,
    };
}

function buildPython(intent) {
    const loops = intent.type === 'game' ? 12 : intent.type === 'story' ? 8 : 4;
    return [
        '# Entrybot object Python code',
        '',
        'import Entry',
        '',
        'def when_start():',
        `    for i in range(${loops}):`,
        '        Entry.move_to_direction(10)',
        '',
    ].join('\n');
}

function buildPlan(prompt, intent, project, pythonSource) {
    return {
        prompt,
        intent,
        artifacts: {
            projectJson: 'write with --out-project',
            entryPython: 'write with --out-python',
        },
        projectSummary: summarizeProject(project),
        implementationNotes: [
            'Use generated JSON as the starter project and keep it as the local source of truth.',
            'Run static validation before live browser execution.',
            'Sync Entry Python in CodeMirror, export the project, and use the exported JSON for future edits.',
            'Replace placeholder SVG data URLs with generated or user-provided assets when visual fidelity matters.',
        ],
        acceptanceChecks: [
            'Entry.loadProject accepts the project without throwing.',
            'Entry.getMainWS().syncCode succeeds for the Python source.',
            'Running at the requested speed changes at least one object state when behavior is expected.',
            'entry_determinism_check passes for timing-sensitive projects.',
            'entry_visual_compare passes against the approved baseline when a baseline exists.',
        ],
        pythonPreview: pythonSource,
    };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const prompt = args.prompt || (args['prompt-file'] ? readFileSync(args['prompt-file'], 'utf8') : '');
    if (!prompt.trim()) {
        throw new Error('Pass --prompt <text> or --prompt-file <path>.');
    }

    const { project, intent } = buildProject(prompt, { title: args.title });
    const pythonSource = buildPython(intent);
    const plan = buildPlan(prompt, intent, project, pythonSource);

    if (args['out-project']) {
        writeFileSync(args['out-project'], `${JSON.stringify(project, null, 2)}\n`, 'utf8');
    }
    if (args['out-python']) {
        writeFileSync(args['out-python'], pythonSource, 'utf8');
    }
    if (args['out-plan']) {
        writeFileSync(args['out-plan'], `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
    }

    printOrWriteJson({
        ok: true,
        intent,
        projectSummary: summarizeProject(project),
        files: {
            project: args['out-project'] || null,
            python: args['out-python'] || null,
            plan: args['out-plan'] || null,
        },
    }, args.out);
}

main();
