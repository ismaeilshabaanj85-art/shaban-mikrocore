import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateScenarioScript,
  getMissingScenarioQuestions,
} from './troubleshooterEngine';
import { queryIsmaeilAi } from './assistantEngine';
import {
  createInitialSandboxState,
  executeSandboxCommand,
} from './sandboxEngine';

test('Troubleshooter enforces interactive Q&A for missing parameters before generating script', () => {
  const missingInitial = getMissingScenarioQuestions('port_forward', {});
  assert.equal(missingInitial.length, 4);

  const missingPartial = getMissingScenarioQuestions('port_forward', {
    wanInterface: 'ether1',
    extPort: '8080',
  });
  assert.equal(missingPartial.length, 2);

  const complete = getMissingScenarioQuestions('port_forward', {
    wanInterface: 'ether1',
    extPort: '8080',
    targetIp: '192.168.88.50',
    intPort: '80',
  });
  assert.equal(complete.length, 0);

  const script = generateScenarioScript(
    'port_forward',
    {
      wanInterface: 'ether1',
      extPort: '8080',
      targetIp: '192.168.88.50',
      intPort: '80',
    },
    'v7'
  );
  assert.equal(script.includes('action=dst-nat to-addresses=192.168.88.50 to-ports=80'), true);
});

test('ismaeil AI returns relevant bilingual guidance and module links across all topics', () => {
  const arStarlink = queryIsmaeilAi('حل بطء الألعاب والبينغ على ستارلينك', 'ar');
  assert.equal(arStarlink.suggestedModule, 'pcc_security');
  assert.equal(arStarlink.text.includes('1440'), true);

  const arSafe = queryIsmaeilAi('كيف أحظر المواقع الإباحية على الشبكة؟', 'ar');
  assert.equal(arSafe.suggestedModule, 'pcc_security');
  assert.equal(arSafe.text.includes('185.228.168.168'), true);

  const arZeroTouch = queryIsmaeilAi('برمجة الراوتر من الصفر', 'ar');
  assert.equal(arZeroTouch.suggestedModule, 'wizard');

  const enCisco = queryIsmaeilAi('How to configure Cisco VLAN and OSPF?', 'en');
  assert.equal(enCisco.suggestedModule, 'cisco');

  const enFinance = queryIsmaeilAi('How do reseller debt limits and SYP/TRY work?', 'en');
  assert.equal(enFinance.suggestedModule, 'finance');
});

test('Sandbox Simulator validates RouterOS v6/v7 and Cisco IOS syntax and mutates virtual state', () => {
  const state = createInitialSandboxState('v7');

  const ipRes = executeSandboxCommand(
    state,
    'mikrotik',
    '/ip address add address=172.16.0.1/24 interface=ether5-Tower'
  );
  assert.equal(ipRes.ok, true);
  assert.equal(
    ipRes.nextState.mikrotikInterfaces.some((i) => i.ip === '172.16.0.1/24'),
    true
  );

  // Invalid MikroTik command highlights syntax error
  const badRes = executeSandboxCommand(state, 'mikrotik', 'invalid command xyz');
  assert.equal(badRes.ok, false);
  assert.equal(badRes.errorHighlight, 'invalid command xyz');

  // RouterOS v6 rejects v7 /routing table syntax
  const v6State = createInitialSandboxState('v6');
  const v6Err = executeSandboxCommand(v6State, 'mikrotik', '/routing table add name=to-WAN1 fib');
  assert.equal(v6Err.ok, false);

  // Cisco VLAN command mutates virtual switch
  const ciscoRes = executeSandboxCommand(state, 'cisco', 'vlan 50');
  assert.equal(ciscoRes.ok, true);
  assert.equal(ciscoRes.nextState.ciscoVlans.some((v) => v.id === 50), true);
});
