/**
 * SDK 内部播放协调器（与宿主 mediaCoordinator 思路一致，零依赖）。
 *
 * SDK 保持业务无关：默认用自己的内部 registry 避免同屏两个 ExplainVideoPlayer 串台；
 * 宿主若已有全局协调器，通过 <ExplainVideoPlayer onRequestPlay={claimMediaPlayback} />
 * 注入即可让本播放器与 TTS / 媒体播放器互斥。
 */

export interface MediaControllable {
  stop: () => void;
}

const registry = new Map<string, MediaControllable>();
const listeners = new Set<(activeId: string | null) => void>();
let activeId: string | null = null;

function broadcast(): void {
  listeners.forEach((fn) => fn(activeId));
}

export function registerPlayer(id: string, ctl: MediaControllable): () => void {
  registry.set(id, ctl);
  return () => {
    if (registry.get(id) === ctl) registry.delete(id);
    if (activeId === id) {
      activeId = null;
      broadcast();
    }
  };
}

/** 申请播放权：停掉除 selfId 外的所有 SDK 播放器实例 */
export function claimPlayback(selfId: string): void {
  registry.forEach((ctl, id) => {
    if (id !== selfId) ctl.stop();
  });
  if (activeId !== selfId) {
    activeId = stateSet(selfId);
  }
}

function stateSet(id: string | null): string | null {
  activeId = id;
  broadcast();
  return id;
}

export function releasePlayback(selfId: string): void {
  if (activeId === selfId) stateSet(null);
}

export function getActivePlayerId(): string | null {
  return activeId;
}

export function subscribeActive(fn: (activeId: string | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
