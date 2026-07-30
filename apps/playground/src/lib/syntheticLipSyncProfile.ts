import type { LipSyncProfile } from 'live2d-jsx'

const PHONEMES = ['A', 'I', 'U', 'E', 'O', 'S'] as const
const MFCC_COUNT = 12
const CALIBRATION_SAMPLES = 12

/**
 * Deterministic, synthetic calibration data for the local AudioWorklet smoke
 * test. It is intentionally not a speech-quality profile.
 */
export const SYNTHETIC_LIPSYNC_PROFILE: LipSyncProfile = {
  compareMethod: 0,
  melFilterBankChannels: 30,
  mfccDataCount: PHONEMES.length,
  mfccNum: MFCC_COUNT,
  mfccs: PHONEMES.map((name, phonemeIndex) => ({
    mfccCalibrationDataList: Array.from(
      { length: CALIBRATION_SAMPLES },
      (_, sampleIndex) => ({
        array: Array.from(
          { length: MFCC_COUNT },
          (_, coefficientIndex) =>
            Math.sin((phonemeIndex + 1) * (coefficientIndex + 1) * 0.37)
            + sampleIndex * 0.0001,
        ),
      }),
    ),
    name,
  })),
  sampleCount: 1024,
  targetSampleRate: 16_000,
  useStandardization: false,
}
