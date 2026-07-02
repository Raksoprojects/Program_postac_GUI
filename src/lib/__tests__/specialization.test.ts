import { describe, it, expect } from "vitest";
import {
  parseSpecialization,
  needsSpecialization,
  buildSpecializedName
} from "../specialization";

describe("specialization: parsowanie nazw ze schematu (Faza C, pkt 9/10)", () => {
  it("nazwa bez nawiasu = brak specjalizacji", () => {
    const info = parseSpecialization("Leczenie");
    expect(info.kind).toBe("none");
    expect(info.base).toBe("Leczenie");
    expect(info.inner).toBeNull();
    expect(needsSpecialization(info)).toBe(false);
  });

  it("konkretna specjalizacja nie wymaga pytania", () => {
    const info = parseSpecialization("Wiedza (Medycyna)");
    expect(info.kind).toBe("none");
    expect(info.base).toBe("Wiedza");
    expect(info.inner).toBe("Medycyna");
    expect(needsSpecialization(info)).toBe(false);
  });

  it("(Dowolne) = wpis dowolny bez podpowiedzi", () => {
    const info = parseSpecialization("Rzemiosło (Dowolne)");
    expect(info.kind).toBe("free");
    expect(info.base).toBe("Rzemiosło");
    expect(info.hint).toBe("");
    expect(needsSpecialization(info)).toBe(true);
  });

  it("(Dowolny Kolor) = wpis dowolny z podpowiedzią kategorii", () => {
    expect(parseSpecialization("Splatanie Magii (Dowolny Kolor)").hint).toBe("Kolor");
    expect(parseSpecialization("Błogosławieństwo (Dowolne Bóstwo)").hint).toBe("Bóstwo");
    expect(parseSpecialization("Magia Tajemna (Dowolna Tradycja)").hint).toBe("Tradycja");
    expect(parseSpecialization("Znawca (Dowolna Dziedzina)").hint).toBe("Dziedzina");
  });

  it("placeholder (...) i pusty nawias = wpis dowolny", () => {
    expect(parseSpecialization("Wiedza (...)").kind).toBe("free");
    expect(parseSpecialization("Wiedza ()").kind).toBe("free");
  });

  it("(A albo B) = wybór spośród opcji", () => {
    const info = parseSpecialization("Rzemiosło (Kowalstwo albo Złotnik)");
    expect(info.kind).toBe("choice");
    expect(info.options).toEqual(["Kowalstwo", "Złotnik"]);
    expect(needsSpecialization(info)).toBe(true);
  });

  it("(A albo B albo C) = trzy opcje", () => {
    const info = parseSpecialization("Wytwórca (Inżynier albo Kowalstwo albo Złotnik)");
    expect(info.kind).toBe("choice");
    expect(info.options).toEqual(["Inżynier", "Kowalstwo", "Złotnik"]);
  });

  it("buildSpecializedName tworzy nazwę Baza (Wybrana)", () => {
    expect(buildSpecializedName("Język", "Bretoński")).toBe("Język (Bretoński)");
    expect(buildSpecializedName("Rzemiosło ", " Kowalstwo ")).toBe("Rzemiosło (Kowalstwo)");
    expect(buildSpecializedName("Coś", "")).toBe("Coś");
  });
});
