const DEVICE_IMPEDANCE_BASELINE = 500;
const IMPEDANCE_DIVISOR = 50;
const WATER_FACTOR = 0.726;
const MUSCLE_FACTOR = 0.67;
const BMR_FACTOR = 21.6;
const BMR_OFFSET = 370;
const BMI_PROTEIN_CENTER = 22;
const PROTEIN_BASE = 18;
const PROTEIN_LIMIT = 2.5;

const roundTo = (value, digits) => {
  const factor = 10 ** digits;
  return Math.floor(value * factor + 0.5) / factor;
};

const truncateTo = (value, digits) => {
  const factor = 10 ** digits;
  return Math.trunc(value * factor) / factor;
};

const sign = (value) => {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
};

const normalizeSexCode = (sex) => {
  if (typeof sex === "number") {
    if (sex === 1 || sex === 2) return sex;
  }

  const normalized = String(sex || "")
    .trim()
    .toLowerCase();

  if (["male", "man", "m", "男"].includes(normalized)) return 1;
  if (["female", "woman", "f", "女"].includes(normalized)) return 2;

  throw new Error("Unsupported sex value");
};

const normalizeAge = (age) => Math.trunc(Number(age) || 0);
const normalizeOptionalPositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export class YunmaiMetricsCalculator {
  static getBmi(heightCm, weightKg) {
    const heightM = heightCm / 100;
    return roundTo(weightKg / (heightM * heightM), 1);
  }

  static getImpedanceAdjust(impedance) {
    const diff = impedance - DEVICE_IMPEDANCE_BASELINE;
    return sign(diff) * Math.pow(Math.abs(diff) / IMPEDANCE_DIVISOR, 1 / 3);
  }

  static getFatPercent({ heightCm, age, sex, weightKg, impedance }) {
    const normalizedImpedance = normalizeOptionalPositiveNumber(impedance);
    if (!normalizedImpedance) return null;
    const sexCode = normalizeSexCode(sex);
    const normalizedAge = normalizeAge(age);
    const heightM = heightCm / 100;
    const base = (1.5 * weightKg) / (heightM * heightM) + 0.08 * normalizedAge;
    const impedanceAdjust = this.getImpedanceAdjust(normalizedImpedance);
    const sexOffset = sexCode === 1 ? 18.2 : 7.4;
    return truncateTo(base - sexOffset + impedanceAdjust, 1);
  }

  static getMusclePercent(fatPercent) {
    if (fatPercent == null) return null;
    return roundTo((100 - fatPercent) * MUSCLE_FACTOR, 1);
  }

  static getWaterPercent(fatPercent) {
    if (fatPercent == null) return null;
    return roundTo((100 - fatPercent) * WATER_FACTOR, 1);
  }

  static getProteinPercent(bmi) {
    let offset;

    if (bmi > BMI_PROTEIN_CENTER) {
      offset = -Math.pow(bmi - BMI_PROTEIN_CENTER, 0.25);
    } else {
      offset = Math.pow(BMI_PROTEIN_CENTER - bmi, 1 / 3);
    }

    const boundedOffset = Math.max(-PROTEIN_LIMIT, Math.min(PROTEIN_LIMIT, offset));
    return roundTo(PROTEIN_BASE + boundedOffset, 2);
  }

  static getBmr(weightKg, fatPercent) {
    if (fatPercent == null) return null;
    return roundTo((1 - fatPercent / 100) * BMR_FACTOR * weightKg + BMR_OFFSET, 1);
  }

  static getSomaAge(age, bmi) {
    const normalizedAge = normalizeAge(age);
    let factor;

    if (bmi <= 30) {
      factor = 1;
    } else if (bmi <= 35) {
      factor = (1 + (bmi - 30) / 100) * (1 + (bmi - 35) / 100);
    } else if (bmi <= 40) {
      factor = 1 + (bmi - 30) / 100;
    } else {
      factor =
        (1 + (bmi - 30) / 100) *
        (1 + (bmi - 35) / 100) *
        (1 + (bmi - 40) / 100);
    }

    const delta = bmi - 14;
    const root = delta < 0 ? -Math.sqrt(Math.abs(delta)) : Math.sqrt(delta);
    return Math.trunc((normalizedAge + root) * factor);
  }

  static getFatMassKg(weightKg, fatPercent) {
    if (fatPercent == null) return null;
    return roundTo((weightKg * fatPercent) / 100, 2);
  }

  static getFatMassJin(weightKg, fatPercent) {
    const fatMassKg = this.getFatMassKg(weightKg, fatPercent);
    return fatMassKg == null ? null : roundTo(fatMassKg * 2, 1);
  }

  static calculate(input) {
    const normalizedAge = normalizeAge(input.age);
    const bmi = this.getBmi(input.heightCm, input.weightKg);
    const fatPercent = this.getFatPercent({ ...input, age: normalizedAge });
    const musclePercent = this.getMusclePercent(fatPercent);
    const waterPercent = this.getWaterPercent(fatPercent);
    const proteinPercent = this.getProteinPercent(bmi);
    const bmr = this.getBmr(input.weightKg, fatPercent);
    const somaAge = this.getSomaAge(normalizedAge, bmi);
    const fatMassKg = this.getFatMassKg(input.weightKg, fatPercent);
    const fatMassJin = this.getFatMassJin(input.weightKg, fatPercent);

    return {
      weightKg: input.weightKg,
      impedance: input.impedance,
      age: normalizedAge,
      heightCm: input.heightCm,
      sex: input.sex,
      fatPercent,
      bmi,
      musclePercent,
      waterPercent,
      proteinPercent,
      bmr,
      somaAge,
      fatMassKg,
      fatMassJin,
    };
  }
}

export const calculateYunmaiMetrics = (input) =>
  YunmaiMetricsCalculator.calculate(input);
