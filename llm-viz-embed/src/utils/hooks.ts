// Vanilla version of hooks - no React dependency

export class Subscriptions {
    subs = new Set<() => void>();
    subscribe = (fn: () => void): (() => void) => {
        this.subs.add(fn);
        return () => this.subs.delete(fn);
    }
    notify = () => {
        for (let sub of this.subs) {
            sub();
        }
    }
}

export function logChangesFn(name: string) {
    let prevValue: any = null;
    return (currValue: any) => {
        let changes = getChanges(prevValue, currValue);
        prevValue = currValue;
        changes && console.log(`${name} changed to`, changes);
        return !!changes;
    };

    function getChanges(a: any, b: any) {
        a = a || {};
        b = b || {};
        let keys = new Set<string>();
        for (let k of [...Object.keys(a), ...Object.keys(b)]) {
            a[k] !== b[k] && keys.add(k);
        }
        if (keys.size === 0) {
            return null;
        }
        let changed: any = {};
        for (let k of [...keys]) {
            changed[k] = b[k];
        }
        return changed;
    }
}
