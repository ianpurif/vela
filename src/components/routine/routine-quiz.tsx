"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoutineResults } from "@/components/routine/routine-results";
import { quizQuestions } from "@/components/routine/quiz-questions";
import {
  buildRoutine,
  emptyRoutineDraft,
  routineAnswersSchema,
  type RoutineDraft,
} from "@/features/routine/matching";
import { cn } from "@/lib/utils";
import type { Concern, Product } from "@/types/commerce";

function QuestionPanel({
  step,
  draft,
  choose,
  next,
  back,
  focusOnMount,
}: {
  step: number;
  draft: RoutineDraft;
  choose: (field: keyof RoutineDraft, value: string) => void;
  next: () => void;
  back: () => void;
  focusOnMount: boolean;
}) {
  const question = quizQuestions[step];
  const heading = useRef<HTMLHeadingElement>(null);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (focusOnMount) heading.current?.focus();
  }, [focusOnMount]);
  return (
    <motion.form
      initial={{ opacity: 0, y: reducedMotion ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reducedMotion ? 0 : -8 }}
      transition={{ duration: reducedMotion ? 0 : 0.18 }}
      onSubmit={(event) => {
        event.preventDefault();
        if (draft[question.field] !== null) next();
      }}
      className="min-w-0"
    >
      <fieldset
        className="m-0 min-w-0 border-0 p-0"
        aria-describedby="routine-question-description"
      >
        <legend className="mb-4 block w-full p-0">
          <h2
            ref={heading}
            tabIndex={-1}
            className="mb-0 max-w-xl text-[38px] leading-[1.05] outline-offset-8 sm:text-[46px]"
          >
            {question.title}
          </h2>
        </legend>
        <p
          id="routine-question-description"
          className="mb-7 max-w-lg text-xs leading-7 text-olive/80"
        >
          {question.description}
        </p>
        <div
          className={cn(
            "grid gap-3",
            question.options.length >= 4 ? "sm:grid-cols-2" : "grid-cols-1",
          )}
        >
          {question.options.map((option) => {
            const selected =
              question.field === "concerns"
                ? draft.concerns !== null &&
                  (option.value === "none"
                    ? draft.concerns.length === 0
                    : draft.concerns.includes(option.value as Concern))
                : draft[question.field] === option.value;
            const id = `routine-${question.field}-${option.value}`;
            return (
              <label key={option.value} className="relative block cursor-pointer">
                <input
                  id={id}
                  type={question.field === "concerns" ? "checkbox" : "radio"}
                  name={`routine-${question.field}`}
                  value={option.value}
                  checked={selected}
                  onChange={() => choose(question.field, option.value)}
                  aria-labelledby={`${id}-label`}
                  aria-describedby={`${id}-description`}
                  className="peer sr-only"
                />
                <span className="flex h-full items-start gap-3 border border-olive/20 bg-ivory/60 p-4 transition-colors hover:border-olive/50 peer-checked:border-olive peer-checked:bg-sand/30 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-olive sm:p-5">
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border",
                      question.field === "concerns" ? "rounded-none" : "rounded-full",
                      selected ? "border-olive bg-olive text-ivory" : "border-olive/30",
                    )}
                    aria-hidden="true"
                  >
                    {selected && <Check size={10} strokeWidth={2} />}
                  </span>
                  <span>
                    <span id={`${id}-label`} className="mb-1.5 block text-xs font-semibold">
                      {option.label}
                    </span>
                    <span
                      id={`${id}-description`}
                      className="block text-[11px] leading-6 text-olive/80"
                    >
                      {option.description}
                    </span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-8 flex items-center justify-between gap-4 border-t border-olive/15 pt-6">
        <Button
          type="button"
          variant="ghost"
          onClick={back}
          disabled={step === 0}
          className="px-1 text-[11px]"
        >
          <ArrowLeft size={14} />
          Back
        </Button>
        <Button type="submit" disabled={draft[question.field] === null} className="px-5 sm:px-7">
          {step === quizQuestions.length - 1 ? "See my ritual" : "Continue"}
          <ArrowRight size={14} />
        </Button>
      </div>
      {draft[question.field] === null && (
        <p className="mt-3 mb-0 text-right text-[11px] text-olive/80">
          Choose {question.field === "concerns" ? "your focus" : "an option"} to continue.
        </p>
      )}
    </motion.form>
  );
}

export function RoutineQuiz({ products }: { products: Product[] }) {
  const [draft, setDraft] = useState<RoutineDraft>(emptyRoutineDraft);
  const [step, setStep] = useState(0);
  const [complete, setComplete] = useState(false);
  const [focusOnMount, setFocusOnMount] = useState(false);
  const reducedMotion = useReducedMotion();
  const parsed = routineAnswersSchema.safeParse(draft);
  function choose(field: keyof RoutineDraft, value: string) {
    setDraft((previous) => {
      if (field !== "concerns") return { ...previous, [field]: value };
      if (value === "none")
        return { ...previous, concerns: previous.concerns?.length === 0 ? null : [] };
      const concern = value as Concern;
      const concerns = previous.concerns ?? [];
      return {
        ...previous,
        concerns: concerns.includes(concern)
          ? concerns.filter((item) => item !== concern)
          : [...concerns, concern],
      };
    });
  }
  function next() {
    setFocusOnMount(true);
    if (step < quizQuestions.length - 1) setStep(step + 1);
    else if (parsed.success) setComplete(true);
  }
  function back() {
    setFocusOnMount(true);
    setStep(Math.max(0, step - 1));
  }
  if (complete && parsed.success)
    return (
      <RoutineResults
        answers={parsed.data}
        result={buildRoutine(products, parsed.data)}
        onEdit={() => {
          setComplete(false);
          setStep(0);
          setFocusOnMount(true);
        }}
      />
    );
  return (
    <section className="wrap py-10 pb-16 sm:py-14 sm:pb-24">
      <div className="grid items-start gap-8 lg:grid-cols-[.75fr_1fr] lg:gap-14 xl:gap-20">
        <div className="lg:sticky lg:top-28">
          <p className="eyebrow mb-4 text-olive/80">The ritual finder</p>
          <h1 className="mb-5 text-[52px] leading-[.95] sm:text-[68px]">
            Your skin.
            <br />
            <em className="font-normal">Your rhythm.</em>
          </h1>
          <p className="mb-7 max-w-sm text-xs leading-7 text-olive/80">
            Five thoughtful questions. A considered edit from our current collection, with a reason
            for every step.
          </p>
          <div className="relative hidden aspect-[4/3] overflow-hidden bg-sand sm:block lg:aspect-[4/5]">
            <Image
              src="/images/cream-ritual.webp"
              alt="A quiet skincare ritual in warm natural light"
              fill
              sizes="(max-width: 1024px) 80vw, 38vw"
              loading="eager"
              className="object-cover object-[center_40%]"
            />
            <span className="absolute bottom-5 left-5 bg-ivory/90 px-4 py-3 text-[11px] tracking-[.14em] uppercase">
              A moment that belongs to you.
            </span>
          </div>
          <Link
            href="/shop"
            className="mt-5 inline-flex items-center gap-2 text-[11px] text-olive/80 underline underline-offset-4"
          >
            Explore the collection
            <ArrowRight size={12} />
          </Link>
        </div>
        <div className="min-w-0 pt-2 lg:pt-1">
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between text-[11px] tracking-[.13em] text-olive/80 uppercase">
              <span>
                Step {step + 1} of {quizQuestions.length}
              </span>
              <span>{quizQuestions[step].short}</span>
            </div>
            <div
              role="progressbar"
              aria-label="Routine finder progress"
              aria-valuemin={1}
              aria-valuemax={quizQuestions.length}
              aria-valuenow={step + 1}
              aria-valuetext={`Step ${step + 1} of ${quizQuestions.length}: ${quizQuestions[step].short}`}
              className="h-px bg-olive/15"
            >
              <motion.div
                animate={{ width: `${((step + 1) / quizQuestions.length) * 100}%` }}
                transition={{ duration: reducedMotion ? 0 : 0.25 }}
                className="h-px bg-olive"
              />
            </div>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <QuestionPanel
              key={step}
              step={step}
              draft={draft}
              choose={choose}
              next={next}
              back={back}
              focusOnMount={focusOnMount}
            />
          </AnimatePresence>
          <p className="mt-7 mb-0 text-[11px] leading-6 text-olive/80">
            Your choices shape this edit using the catalog’s skin type, concern, and fragrance
            labels.
          </p>
        </div>
      </div>
    </section>
  );
}
