// Device terminal messages (short, single-line)
export const TERM = {
  // session lifecycle
  STARTING:        (tokenId:number) => `starting mining session for cartridge #${tokenId}...`,
  LOCK_ACQUIRED:   (ttlMin:number)  => `lock acquired. exclusive access for ~${ttlMin} min.`,
  LOCK_DENIED:     (tokenId:number, owner:string, ttlMin:number) =>
                    `cartridge #${tokenId} is in use by ${owner}. retry after ~${ttlMin} min.`,
  RESUMED:         (tokenId:number) => `session resumed for cartridge #${tokenId}.`,
  STOPPING:        (tokenId:number) => `stopping session for cartridge #${tokenId}...`,
  STOPPED:         (tokenId:number) => `session ended for cartridge #${tokenId}.`,

  // heartbeats
  HEARTBEAT_OK:    (ms:number)      => `heartbeat ok (${ms} ms).`,
  HEARTBEAT_MISSED:(sec:number)     => `missed heartbeat by ${sec}s. attempting recover...`,
  HEARTBEAT_OWNER_MISMATCH:(tokenId:number) =>
                    `lock owner mismatch on #${tokenId}. session halted.`,

  // caps & limits
  WALLET_CAP_HIT:  (active:number, limit:number) =>
                    `session limit reached: ${active}/${limit} active. close one to start another.`,
  TX_RATE_LIMIT:   ()               => `too many requests. backing off...`,

  // network & auth
  NOT_CONNECTED:   ()               => `wallet not connected. connect to continue.`,
  WRONG_CHAIN:     (want:string, got:string) =>
                    `wrong network: need ${want}, got ${got}.`,
  PROVIDER_ERROR:  (msg:string)     => `provider error: ${msg}`,

  // balance & spending
  PRICE_INFO:      (price:string, total:string, feeEst?:string) =>
                    `price ${price} APE, total ${total} APE${feeEst ? `, fee ~${feeEst} APE` : ''}.`,
  INSUFF_FUNDS:    (need:string, have:string) =>
                    `insufficient balance: need ${need} APE, have ${have} APE.`,
  INSUFF_FEE:      (fee:string)     => `insufficient for network fee (~${fee} APE).`,

  // contract state
  SALE_PAUSED:     ()               => `sale paused by contract.`,
  SOLD_OUT:        ()               => `sold out.`,
  WALLET_LIMIT:    ()               => `wallet mint limit reached.`,
  ERC20_APPROVAL:  (symbol:string)  => `approval required for ${symbol}.`,

  // preflight / simulation
  PREFLIGHT_OK:    ()               => `simulation ok.`,
  PREFLIGHT_FAIL:  (reason:string)  => `simulation failed: ${reason}`,

  // mining progress
  TICK:            (hashrate:string) => `mining... hashrate ${hashrate}`,
  REWARDS_READY:   (amt:string)      => `rewards ready: ${amt} ABIT`,
  CLAIM_SENT:      (tx:string)       => `claim submitted: ${tx}`,
  CLAIM_CONFIRMED: (tx:string)       => `claim confirmed: ${tx}`,

  // cooldown & transfer
  COOLDOWN:        (min:number, eta:string) =>
                    `cartridge cooling down ~${min} min (until ${eta}).`,
  TRANSFER_DETECTED:(tokenId:number) => `transfer detected for #${tokenId}. applying cooldown.`,
};

// UI toast/banner/modal copy (user-friendly)
export const TOAST = {
  START_OK:      (tokenId:number) => `Mining started for cartridge #${tokenId}.`,
  START_DENIED:  (tokenId:number) => `Cartridge #${tokenId} is currently in use.`,
  CAP_HIT:       (limit:number)   => `You reached the maximum of ${limit} concurrent sessions.`,
  HEARTBEAT_LOST:()               => `Connection lost. Trying to recover your session...`,
  WRONG_CHAIN:   (want:string)    => `Switch to ${want} to continue.`,
  INSUFF_FUNDS:  ()               => `Not enough APE to proceed.`,
  SALE_PAUSED:   ()               => `Minting is paused.`,
  SOLD_OUT:      ()               => `All cartridges are sold out.`,
  COOLDOWN:      (min:number)     => `This cartridge is cooling down for ~${min} minutes.`,
};

// Confirmation / blocking modal titles & bodies
export const MODAL = {
  CAP_EXCEEDED: {
    title: 'Session limit reached',
    body:  (active:number, limit:number) =>
      `You already have ${active} active mining sessions. The limit is ${limit}. Close a session to start another.`,
    cta:   'View active sessions',
  },
  CART_IN_USE: {
    title: 'Cartridge is in use',
    body:  (tokenId:number, eta:string) =>
      `Cartridge #${tokenId} is being mined in another session. It should free up around ${eta}.`,
    cta:   'Got it',
  },
  COOLDOWN: {
    title: 'Cooldown active',
    body:  (tokenId:number, min:number) =>
      `Cartridge #${tokenId} is under cooldown for approximately ${min} more minutes.`,
    cta:   'Ok',
  },
  APPROVAL_NEEDED: {
    title: 'Approval needed',
    body:  (symbol:string) =>
      `You must approve spending of ${symbol} before continuing.`,
    cta:   'Approve',
  },
  SWITCH_NETWORK: {
    title: 'Wrong network',
    body:  (want:string, got:string) =>
      `Please switch to ${want}. You are currently on ${got}.`,
    cta:   'Switch network',
  },
};

// Inline help/tooltips
export const HELP = {
  SESSIONS_BADGE: (active:number, limit:number) =>
    `Active sessions: ${active}/${limit}. Each session mines one cartridge.`,
  LOCK_DEF:       () =>
    `A lock reserves one cartridge for a single session. Lock duration ~= 60 minutes.`,
  HEARTBEAT_DEF:  () =>
    `Heartbeats keep your lock alive. Closing the tab or going offline lets the lock expire.`,
  PARALLEL_MINING:() =>
    `You can mine multiple cartridges in parallel, up to your session limit.`,
  COOLDOWN_DEF:   () =>
    `After ownership changes or session stop, cartridges may have a cooldown window before they can be mined again.`,
};

// Error mapping (HTTP → user copy)
export const ERROR_MAP: Record<string, {title:string; message:(p:any)=>string}> = {
  cartridge_in_use: {
    title: 'Cartridge in use',
    message: ({ tokenId, eta }) =>
      `Cartridge #${tokenId} is already being mined. Try again around ${eta}.`
  },
  wallet_session_limit_exceeded: {
    title: 'Session limit reached',
    message: ({ active, limit }) =>
      `You have ${active} active sessions. The maximum allowed is ${limit}.`
  },
  lock_owned_elsewhere: {
    title: 'Session conflict',
    message: ({ tokenId }) =>
      `Your session no longer owns the lock for cartridge #${tokenId}. It was taken by another session.`
  },
  lock_expired: {
    title: 'Session expired',
    message: () => `Your session expired due to inactivity. Start a new session to continue.`
  },
  insufficient_funds: {
    title: 'Insufficient funds',
    message: ({ need, have }) => `You need ${need} APE, you have ${have} APE.`
  },
  wrong_network: {
    title: 'Wrong network',
    message: ({ want, got }) => `Switch to ${want}. You are on ${got}.`
  },
  sale_paused: {
    title: 'Paused',
    message: () => `The contract has paused minting. Please check back later.`
  },
  sold_out: {
    title: 'Sold out',
    message: () => `All cartridges have been minted.`
  },
  approval_required: {
    title: 'Approval required',
    message: ({ symbol }) => `Approve ${symbol} before proceeding.`
  },
  rpc_timeout: {
    title: 'Network timeout',
    message: () => `The network did not respond in time. Please try again.`
  },
  unknown: {
    title: 'Unexpected error',
    message: ({ detail }) => detail || 'Something went wrong. Please try again.'
  }
};

// Status badges/labels
export const STATUS = {
  ACTIVE:      'Active',
  WAITING:     'Waiting',
  IN_USE:      'In use',
  COOLDOWN:    'Cooldown',
  EXPIRED:     'Expired',
  DISCONNECTED:'Disconnected',
  PAUSED:      'Paused',
  SOLD_OUT:    'Sold out',
  LIMIT_HIT:   'Limit reached',
};

// Minimal UI strings for list rows/cards
export const CARD = {
  TITLE:        (tokenId:number) => `Cartridge #${tokenId}`,
  SUBTITLE:     (state:string)   => state, // use STATUS
  ACTION_START: 'Start mining',
  ACTION_STOP:  'Stop',
  ACTION_RESUME:'Resume',
  COOLDOWN:     (min:number)     => `Cooldown ~${min} min`,
  EXPIRES_AT:   (eta:string)     => `Expires ~${eta}`,
  SESSIONS:     (active:number, limit:number) => `Sessions ${active}/${limit}`,
};
