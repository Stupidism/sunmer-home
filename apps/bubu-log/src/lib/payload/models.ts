export type AppUserDoc = {
  id: string
  username?: string | null
  password?: string | null
  name?: string | null
  email?: string | null
  image?: string | null
  role?: string | null
  createdAt?: string | null
}

export type BabyDoc = {
  id: string
  name: string
  avatarUrl?: string | null
  birthDate?: string | null
  gender?: 'BOY' | 'GIRL' | 'OTHER' | null
  createdAt?: string | null
}

export type BabyUserDoc = {
  id: string
  baby: string | BabyDoc
  user: string | AppUserDoc
  isDefault?: boolean | null
  createdAt?: string | null
}

export type ActivityDoc = {
  id: string
  type: string
  startTime: string
  endTime?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  babyId: string
  hasPoop?: boolean | null
  hasPee?: boolean | null
  poopColor?: string | null
  poopPhotoUrl?: string | null
  peeAmount?: string | null
  burpSuccess?: boolean | null
  milkAmount?: number | null
  milkSource?: string | null
  breastFirmness?: string | null
  supplementType?: string | null
  spitUpType?: string | null
  count?: number | null
  notes?: string | null
}

export type DailyStatDoc = {
  id: string
  date: string
  babyId: string
  sleepCount: number
  totalSleepMinutes: number
  breastfeedCount: number
  totalBreastfeedMinutes: number
  bottleCount: number
  totalMilkAmount: number
  pumpCount: number
  totalPumpMilkAmount: number
  diaperCount: number
  poopCount: number
  peeCount: number
  exerciseCount: number
  totalHeadLiftMinutes: number
  supplementADCount: number
  supplementD3Count: number
  spitUpCount: number
  projectileSpitUpCount: number
  createdAt?: string | null
  updatedAt?: string | null
}

export type AuditLogDoc = {
  id: string
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  resourceType: 'ACTIVITY'
  resourceId?: string | null
  inputMethod: 'TEXT' | 'VOICE'
  inputText?: string | null
  description?: string | null
  success: boolean
  errorMessage?: string | null
  beforeData?: unknown
  afterData?: unknown
  babyId?: string | null
  activityId?: string | null
  userId?: string | null
  createdAt?: string | null
}
