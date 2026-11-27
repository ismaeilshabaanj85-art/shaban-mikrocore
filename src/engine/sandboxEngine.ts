import { RouterOSVersion, SandboxState } from '../types/mikrocore';

export function createInitialSandboxState(version: RouterOSVersion = 'v7'): SandboxState {
  return {
    mikrotikVersion: version,
    mikrotikIdentity: 'Shaban-RB4011-Lab',
    mikrotikInterfaces: [
      { name: 'ether1-WAN-Starlink', type: 'ether', status: 'up', mac: '48:8F:5A:10:01:01', ip: '192.168.1.2/24', rxMbps: 194.2, txMbps: 28.4 },
      { name: 'ether2-WAN-Fiber', type: 'ether', status: 'up', mac: '48:8F:5A:10:01:02', ip: '10.10.0.2/24', rxMbps: 86.5, txMbps: 14.2 },
      { name: 'ether3-LAN', type: 'ether', status: 'up', mac: '48:8F:5A:10:01:03', rxMbps: 142.0, txMbps: 120.1 },
      { name: 'ether4-LAN', type: 'ether', status: 'up', mac: '48:8F:5A:10:01:04', rxMbps: 64.5, txMbps: 49.0 },
      { name: 'ether5-Tower', type: 'ether', status: 'down', mac: '48:8F:5A:10:01:05', rxMbps: 0, txMbps: 0 },
      { name: 'wlan1-AP', type: 'wlan', status: 'up', mac: '48:8F:5A:10:01:06', rxMbps: 38.4, txMbps: 19.2 },
      { name: 'bridge-LAN', type: 'bridge', status: 'up', mac: '48:8F:5A:10:01:AA', ip: '192.168.88.1/24', rxMbps: 244.9, txMbps: 188.3 },
    ],
    mikrotikRoutes: [
      { dst: '0.0.0.0/0', gateway: '192.168.1.1', table: 'main' },
      { dst: '192.168.88.0/24', gateway: 'bridge-LAN', table: 'main' },
    ],
    mikrotikFirewallRules: [
      'chain=srcnat out-interface=ether1-WAN-Starlink action=masquerade',
      'chain=input connection-state=established,related action=accept',
    ],
    mikrotikActiveUsers: [
      { user: 'MC-884102', ip: '192.168.88.24', service: 'hotspot', uptime: '02:14:09' },
      { user: 'ali_fiber', ip: '10.50.0.12', service: 'pppoe', uptime: '14:33:51' },
      { user: 'MC-917304', ip: '192.168.88.41', service: 'hotspot', uptime: '00:48:12' },
    ],
    ciscoHostname: 'Shaban-Catalyst-3650',
    ciscoVlans: [
      { id: 1, name: 'default', ports: 'Gi0/1-12' },
      { id: 10, name: 'MANAGEMENT', ports: 'Gi0/13-16' },
      { id: 20, name: 'HOTSPOT_USERS', ports: 'Gi0/17-22' },
    ],
    ciscoInterfaces: [
      { name: 'Gi0/1', type: 'cisco_ge', status: 'up', mac: '00:1A:2B:3C:01:01', rxMbps: 112.4, txMbps: 84.2 },
      { name: 'Gi0/2', type: 'cisco_ge', status: 'up', mac: '00:1A:2B:3C:01:02', rxMbps: 48.0, txMbps: 31.1 },
      { name: 'Gi0/23', type: 'cisco_ge', status: 'up', mac: '00:1A:2B:3C:01:23', rxMbps: 310.8, txMbps: 240.5 },
      { name: 'Gi0/24', type: 'cisco_ge', status: 'up', mac: '00:1A:2B:3C:01:24', rxMbps: 295.0, txMbps: 215.2 },
    ],
  };
}

export interface SandboxExecResult {
  ok: boolean;
  output: string;
  nextState: SandboxState;
  errorHighlight?: string;
}

const VALID_MIKROTIK_PREFIXES = [
  '/ip',
  '/interface',
  '/system',
  '/queue',
  '/routing',
  '/tool',
  '/user',
  '/ppp',
  '/certificate',
  '/ping',
  ':put',
  ':log',
  '#',
];

const VALID_CISCO_PREFIXES = [
  'show',
  'configure',
  'conf',
  'hostname',
  'vlan',
  'name',
  'interface',
  'switchport',
  'ip',
  'router',
  'exit',
  'end',
  'write',
  'wr',
  '!',
];

export function executeSandboxCommand(
  state: SandboxState,
  device: 'mikrotik' | 'cisco',
  rawInput: string
): SandboxExecResult {
  const lines = rawInput
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { ok: false, output: 'syntax error: empty command', nextState: state, errorHighlight: '(empty)' };
  }

  let next = structuredClone(state);
  const outputs: string[] = [];

  for (const line of lines) {
    if (device === 'mikrotik') {
      if (line.startsWith('#') || line.startsWith(':log') || line.startsWith(':put')) {
        outputs.push(line.startsWith(':put') ? line.slice(4).trim() : `[OK] ${line}`);
        continue;
      }

      const validPrefix = VALID_MIKROTIK_PREFIXES.some((p) => line.startsWith(p));
      if (!validPrefix) {
        return {
          ok: false,
          output: `syntax error (line): expected RouterOS path starting with /ip, /interface, /system, /queue, /routing, /tool, /ppp`,
          nextState: state,
          errorHighlight: line,
        };
      }

      if (line.startsWith('/routing table') && next.mikrotikVersion === 'v6') {
        return {
          ok: false,
          output: `syntax error (RouterOS v6): "/routing table" is RouterOS v7 syntax only. Switch simulator to v7 or use routing-mark.`,
          nextState: state,
          errorHighlight: line,
        };
      }

      if (line === '/interface print') {
        outputs.push(
          next.mikrotikInterfaces
            .map((i, idx) => `${idx}  ${i.status === 'up' ? 'R' : 'X'}  ${i.name.padEnd(22)} ${i.type.padEnd(8)} ${i.mac}`)
            .join('\n')
        );
      } else if (line === '/ip address print') {
        outputs.push(
          next.mikrotikInterfaces
            .filter((i) => i.ip)
            .map((i, idx) => `${idx}  ${(i.ip || '').padEnd(18)} ${i.name}`)
            .join('\n')
        );
      } else if (line === '/ip route print') {
        outputs.push(
          next.mikrotikRoutes
            .map((r, idx) => `${idx} A S  dst=${r.dst}  gateway=${r.gateway}  table=${r.table}`)
            .join('\n')
        );
      } else if (line === '/ip hotspot active print' || line === '/ppp active print') {
        outputs.push(
          next.mikrotikActiveUsers
            .map((u, idx) => `${idx}  ${u.user.padEnd(14)} ${u.ip.padEnd(16)} ${u.service.padEnd(8)} ${u.uptime}`)
            .join('\n')
        );
      } else if (line === '/system resource print') {
        outputs.push(
          `uptime: 18d07:42:15\nversion: ${next.mikrotikVersion === 'v7' ? '7.16.1 (stable)' : '6.49.15 (long-term)'}\nboard-name: RB4011iGS+\ncpu-load: 18%\nfree-memory: 642.0MiB`
        );
      } else if (line.startsWith('/system identity set')) {
        const match = line.match(/name="?([^"\s]+)"?/);
        if (match) next.mikrotikIdentity = match[1];
        outputs.push(`[APPLIED] Identity set to ${next.mikrotikIdentity}`);
      } else if (line.startsWith('/ip address add')) {
        const addrMatch = line.match(/address=([^\s]+)/);
        const ifMatch = line.match(/interface="?([^"\s]+)"?/);
        if (!addrMatch || !ifMatch) {
          return {
            ok: false,
            output: `syntax error: /ip address add requires address= and interface=`,
            nextState: state,
            errorHighlight: line,
          };
        }
        next.mikrotikInterfaces.push({
          name: ifMatch[1],
          type: 'ether',
          status: 'up',
          mac: '48:8F:5A:10:99:01',
          ip: addrMatch[1],
          rxMbps: 0,
          txMbps: 0,
        });
        outputs.push(`[APPLIED] Added IP ${addrMatch[1]} on ${ifMatch[1]}`);
      } else if (line.startsWith('/ip firewall')) {
        next.mikrotikFirewallRules.push(line);
        outputs.push(`[APPLIED] Firewall rule committed: ${line}`);
      } else if (line.startsWith('/ip route add')) {
        const dst = line.match(/dst-address=([^\s]+)/)?.[1] || '0.0.0.0/0';
        const gw = line.match(/gateway=([^\s]+)/)?.[1] || '192.168.1.1';
        const tbl = line.match(/routing-table="?([^"\s]+)"?/)?.[1] || 'main';
        next.mikrotikRoutes.push({ dst, gateway: gw, table: tbl });
        outputs.push(`[APPLIED] Route ${dst} via ${gw} (${tbl})`);
      } else if (line.startsWith('/ping') || line.startsWith('/tool ping')) {
        const target = line.split(/\s+/)[1] || '1.1.1.1';
        outputs.push(`SEQ HOST             SIZE TTL TIME\n  0 ${target.padEnd(16)} 56   58  14ms\n  1 ${target.padEnd(16)} 56   58  15ms`);
      } else {
        outputs.push(`[SIMULATED OK] ${line}`);
      }
    } else {
      // Cisco IOS Parser
      if (line.startsWith('!')) continue;
      const lower = line.toLowerCase();
      const validCisco = VALID_CISCO_PREFIXES.some((p) => lower.startsWith(p));
      if (!validCisco) {
        return {
          ok: false,
          output: `% Invalid input detected at '^' marker: "${line}"`,
          nextState: state,
          errorHighlight: line,
        };
      }

      if (lower.startsWith('show ip interface brief') || lower === 'sh ip int br') {
        outputs.push(
          `Interface              IP-Address      OK? Method Status   Protocol\n` +
            next.ciscoInterfaces
              .map((i) => `${i.name.padEnd(23)}unassigned      YES unset  ${i.status.padEnd(9)}up`)
              .join('\n')
        );
      } else if (lower.startsWith('show vlan')) {
        outputs.push(
          `VLAN Name                             Status    Ports\n` +
            next.ciscoVlans
              .map((v) => `${String(v.id).padEnd(5)}${v.name.padEnd(33)}active    ${v.ports}`)
              .join('\n')
        );
      } else if (lower.startsWith('show running-config') || lower === 'sh run') {
        outputs.push(
          `!\nhostname ${next.ciscoHostname}\n` +
            next.ciscoVlans.map((v) => `vlan ${v.id}\n name ${v.name}`).join('\n') +
            `\nend`
        );
      } else if (lower.startsWith('hostname ')) {
        next.ciscoHostname = line.split(/\s+/)[1] || next.ciscoHostname;
        outputs.push(`[OK] Hostname updated to ${next.ciscoHostname}`);
      } else if (lower.startsWith('vlan ')) {
        const vid = Number(line.split(/\s+/)[1]);
        if (!Number.isInteger(vid) || vid < 1 || vid > 4094) {
          return {
            ok: false,
            output: `% Invalid VLAN ID (must be 1..4094)`,
            nextState: state,
            errorHighlight: line,
          };
        }
        if (!next.ciscoVlans.some((v) => v.id === vid)) {
          next.ciscoVlans.push({ id: vid, name: `VLAN_${vid}`, ports: 'unassigned' });
        }
        outputs.push(`[OK] VLAN ${vid} configured`);
      } else {
        outputs.push(`[IOS OK] ${line}`);
      }
    }
  }

  return {
    ok: true,
    output: outputs.join('\n'),
    nextState: next,
  };
}
