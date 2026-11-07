import test from 'node:test';import assert from 'node:assert/strict';import {parseClarify} from '../dist/generator-core.js';import {newJob,runJob} from '../dist/generator-engine.js';import {visibleGeneratorMessages} from '../dist/generator-tabs.js';
const reply=`Title: Create a photo of the most beautiful place in the world

## Clarification Required:
Before proceeding, please answer these questions to ensure the desired outcome:

### 1. Which style/genre would you prefer for the generated image?
* Realistic Photo (Default)
* Surreal Scenery
* Minimalistic Landscape

### 2. Preferred size of the generated image?
* Small (640x480 pixels)
* Medium (1280x853 pixels)
* Large (2560x1600 pixels)

### 3. Select a color scheme if desired:
* Colorful
* Monochromatic
* Light/Dark

### 4. Ensure a specific location is provided, either by name or coordinates to obtain an image focused on that spot:

Once you provide the chosen answers, I will generate the appropriate prompt for ChatGPT.`;
test('exact Markdown clarification retains all four questions including free text',()=>{const q=parseClarify(reply);assert.equal(q.length,4);assert.equal(q[0].options.length,3);assert.equal(q[3].options.length,0);assert.match(q[3].question,/specific location/);});
test('Markdown clarification cannot become a completed prompt',async()=>{const j=newJob('Create an image prompt');await runJob(j,async()=>reply);assert.equal(j.status,'clarification');assert.equal(j.text,undefined);});
test('unknown question format gets one repair and remains unfinished if invalid',async()=>{let calls=0;const j=newJob('Create a prompt');await runJob(j,async()=>{calls++;return 'Clarification required: Please choose your subject.';});assert.equal(calls,2);assert.equal(j.status,'paused');assert.equal(j.text,undefined);});
test('Chat and Generate keep distinct views inside the same chat object',()=>{const c={id:'same',mode:'generator',generatorLane:'chat',messages:[{text:'hello',generatorLane:'chat'},{text:'prompt',generatorLane:'generate'}]};assert.equal(visibleGeneratorMessages(c)[0].text,'hello');c.generatorLane='generate';assert.equal(visibleGeneratorMessages(c)[0].text,'prompt');assert.equal(c.id,'same');assert.equal(c.messages.length,2);});
