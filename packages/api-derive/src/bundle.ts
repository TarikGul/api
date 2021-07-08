// Copyright 2017-2021 @polkadot/api-derive authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Observable } from 'rxjs';
import type { ApiInterfaceRx } from '@polkadot/api/types';
import type { AnyFunction } from '@polkadot/types/types';

import * as accounts from './accounts';
import * as balances from './balances';
import * as bounties from './bounties';
import * as chain from './chain';
import * as contracts from './contracts';
import * as council from './council';
import * as democracy from './democracy';
import * as elections from './elections';
import * as imOnline from './imOnline';
import * as membership from './membership';
import * as parachains from './parachains';
import * as session from './session';
import * as society from './society';
import * as staking from './staking';
import * as technicalCommittee from './technicalCommittee';
import * as treasury from './treasury';
import * as tx from './tx';

export { packageInfo } from './packageInfo';
export * from './type';

interface Avail {
  instances: string[];
  withDetect?: boolean;
}

export const derive = { accounts, balances, bounties, chain, contracts, council, democracy, elections, imOnline, membership, parachains, session, society, staking, technicalCommittee, treasury, tx };

type DeriveSection<Section> = {
  [Method in keyof Section]: Section[Method] extends AnyFunction
    ? ReturnType<Section[Method]> // ReturnType<Section[Method]> will be the inner function, i.e. without (api) argument
    : never;
};
type DeriveAllSections<AllSections> = {
  [Section in keyof AllSections]: DeriveSection<AllSections[Section]>
};

export type DeriveCustom = Record<string, Record<string, (instanceId: string, api: ApiInterfaceRx) => (...args: any[]) => Observable<any>>>;

export type ExactDerive = DeriveAllSections<typeof derive>;

// Enable derive only if some of these modules are available
const deriveAvail: Record<string, Avail> = {
  contracts: { instances: ['contracts'] },
  council: { instances: ['council'], withDetect: true },
  democracy: { instances: ['democracy'] },
  elections: { instances: ['phragmenElection', 'electionsPhragmen', 'elections', 'council'], withDetect: true },
  imOnline: { instances: ['imOnline'] },
  membership: { instances: ['membership'] },
  parachains: { instances: ['parachains', 'registrar'] },
  session: { instances: ['session'] },
  society: { instances: ['society'] },
  staking: { instances: ['staking'] },
  technicalCommittee: { instances: ['technicalCommittee'], withDetect: true },
  treasury: { instances: ['treasury'] }
};

/**
 * Returns an object that will inject `api` into all the functions inside
 * `allSections`, and keep the object architecture of `allSections`.
 */
/** @internal */
function injectFunctions<AllSections> (instanceId: string, api: ApiInterfaceRx, allSections: AllSections): DeriveAllSections<AllSections> {
  const queryKeys = Object.keys(api.query);
  const specName = api.runtimeVersion.specName.toString();

  return Object
    .keys(allSections)
    .filter((sectionName) =>
      !deriveAvail[sectionName] ||
      deriveAvail[sectionName].instances.some((q) => queryKeys.includes(q)) ||
      (
        deriveAvail[sectionName].withDetect &&
        deriveAvail[sectionName].instances.some((q) =>
          (api.registry.getModuleInstances(specName, q) || []).some((q) => queryKeys.includes(q))
        )
      )
    )
    .reduce((deriveAcc, sectionName): DeriveAllSections<AllSections> => {
      const section = allSections[sectionName as keyof AllSections];

      deriveAcc[sectionName as keyof AllSections] = Object
        .keys(section)
        .reduce((sectionAcc, _methodName): DeriveSection<typeof section> => {
          const methodName = _methodName as keyof typeof section;
          // Not sure what to do here, casting as any. Though the final types are good
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call
          const method = (section[methodName] as any)(instanceId, api);

          // idem
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
          (sectionAcc as any)[methodName] = method;

          return sectionAcc;
        }, {} as DeriveSection<typeof section>);

      return deriveAcc;
    }, {} as DeriveAllSections<AllSections>);
}

// FIXME The return type of this function should be {...ExactDerive, ...DeriveCustom}
// For now we just drop the custom derive typings
/** @internal */
export function decorateDerive (instanceId: string, api: ApiInterfaceRx, custom: DeriveCustom = {}): ExactDerive {
  return {
    ...injectFunctions(instanceId, api, derive),
    ...injectFunctions(instanceId, api, custom)
  };
}