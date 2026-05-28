/**
 * MockSnmpSession — simulates a real SNMP session without any network I/O.
 *
 * Safety guarantees (enforced here, not just by convention):
 *   - connect() resolves after a realistic async delay (no real TCP/UDP socket)
 *   - get() and walk() return empty arrays (raw OIDs are not used by mock adapters)
 *   - set() does not exist on this class — write operations are structurally absent
 *   - close() is a no-op (nothing to release)
 *
 * Latency model:
 *   The simulated delay range is configurable per session. Default: 10–50 ms.
 *   Delay is added to connect() and can optionally be added to get()/walk()
 *   to emulate slow SNMP walks on large OLTs.
 *
 * When real SNMP is implemented:
 *   Replace this class with a real net-snmp session wrapper that satisfies
 *   the same ISnmpSession interface. No callers need to change.
 */

import type { MockSnmpConnectConfig } from "./types";

// ─── Shared session interface ──────────────────────────────────────────────
// Defined here so real adapters can implement it without importing mock code.

export interface RawOidEntry {
  oid: string;
  type: number;   // net-snmp ObjectType enum value (e.g. 2 = Integer32)
  value: unknown;
}

export interface ISnmpSession {
  /** Open (or verify) the session. Throws on auth failure / unreachable host. */
  connect(): Promise<void>;

  /** Retrieve specific OIDs. Returns one entry per OID. */
  get(oids: string[]): Promise<RawOidEntry[]>;

  /** Walk a subtree rooted at rootOid. Returns all entries found. */
  walk(rootOid: string): Promise<RawOidEntry[]>;

  /** Release the session and free any OS resources. Always call in finally. */
  close(): void;

  /** Returns true if connect() has been called and close() has not. */
  isOpen(): boolean;
}

// ─── Mock session implementation ──────────────────────────────────────────

export class MockSnmpSession implements ISnmpSession {
  private readonly config: Required<MockSnmpConnectConfig>;
  private _open = false;

  /**
   * @param config  Connection parameters (host, community, version, timeoutMs)
   * @param minDelay  Minimum simulated connect delay in ms (default 10)
   * @param maxDelay  Maximum simulated connect delay in ms (default 50)
   */
  constructor(
    config: MockSnmpConnectConfig,
    private readonly minDelay = 10,
    private readonly maxDelay = 50,
  ) {
    this.config = {
      host:      config.host,
      community: config.community ?? "public",
      version:   config.version   ?? "v2c",
      timeoutMs: config.timeoutMs ?? 3_000,
    };
  }

  /**
   * Simulates SNMP session establishment.
   *
   * In a real implementation this would:
   *   1. Create a UDP socket
   *   2. Send sysDescr.0 GET as a connectivity probe
   *   3. Throw on SNMP auth error, timeout, or host-unreachable
   *
   * Here it just waits a realistic random delay and marks the session open.
   */
  async connect(): Promise<void> {
    await simulatedDelay(this.minDelay, this.maxDelay);
    this._open = true;
  }

  /**
   * Simulates SNMP GET for a list of OIDs.
   *
   * Mock adapters derive all their data from the typed MOCK_* constants rather
   * than parsing raw OID values. This method returns empty arrays — raw OID
   * responses are not needed in the mock layer.
   *
   * When real SNMP is implemented, replace this with actual net-snmp GET calls.
   */
  async get(_oids: string[]): Promise<RawOidEntry[]> {
    assertOpen(this._open, this.config.host);
    await simulatedDelay(this.minDelay, this.maxDelay);
    return [];
  }

  /**
   * Simulates SNMP subtree walk (GETBULK / successive GETNEXTs).
   *
   * Same rationale as get() — mock adapters don't consume raw OID values.
   * When real SNMP is implemented, replace with actual net-snmp walk calls.
   */
  async walk(_rootOid: string): Promise<RawOidEntry[]> {
    assertOpen(this._open, this.config.host);
    await simulatedDelay(this.minDelay * 2, this.maxDelay * 3);
    return [];
  }

  /**
   * Closes the session and releases any OS-level resources.
   * In the mock this is a no-op; in the real implementation it destroys
   * the net-snmp session and closes the UDP socket.
   */
  close(): void {
    this._open = false;
  }

  isOpen(): boolean {
    return this._open;
  }

  /** Read-only accessor for the resolved config (useful for debug logging). */
  get resolvedConfig(): Readonly<Required<MockSnmpConnectConfig>> {
    return this.config;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Returns a Promise that resolves after a random delay between minMs and maxMs.
 * Used to simulate realistic SNMP round-trip times so adapter code that is
 * later swapped to real SNMP behaves the same way timing-wise.
 */
export function simulatedDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertOpen(open: boolean, host: string): void {
  if (!open) {
    throw new Error(
      `MockSnmpSession: session to ${host} is not open. ` +
      "Call connect() before get() or walk()."
    );
  }
}
