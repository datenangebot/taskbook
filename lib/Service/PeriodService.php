<?php

declare(strict_types=1);

namespace OCA\Taskbook\Service;

use DateTimeImmutable;
use OCA\Taskbook\Exception\ValidationException;

/** Handles date-only values without converting a calendar date through UTC. */
class PeriodService {
	/** @var list<string> */
	public const REFERENCE_TYPES = ['day', 'week', 'month', 'none'];

	/** @psalm-suppress PossiblyUnusedMethod Instantiated by Nextcloud dependency injection. */
	public function __construct(
		private Clock $clock,
	) {
	}

	/** @return array{referenceType: string, targetDate: DateTimeImmutable|null} */
	public function validate(mixed $referenceType, mixed $targetDate): array {
		if (!is_string($referenceType) || !in_array($referenceType, self::REFERENCE_TYPES, true)) {
			throw new ValidationException('Invalid time reference.');
		}

		if ($referenceType === 'none') {
			if ($targetDate !== null) {
				throw new ValidationException('Entries without a time reference cannot have a target date.');
			}
			return ['referenceType' => $referenceType, 'targetDate' => null];
		}

		return [
			'referenceType' => $referenceType,
			'targetDate' => $this->normalize($referenceType, $this->parseDate($targetDate)),
		];
	}

	public function today(): DateTimeImmutable {
		return $this->clock->today();
	}

	public function weekStart(DateTimeImmutable $date): DateTimeImmutable {
		return $date->setISODate((int)$date->format('o'), (int)$date->format('W'))->setTime(0, 0);
	}

	public function monthStart(DateTimeImmutable $date): DateTimeImmutable {
		return $date->setDate((int)$date->format('Y'), (int)$date->format('m'), 1)->setTime(0, 0);
	}

	public function format(?DateTimeImmutable $date): ?string {
		return $date?->format('Y-m-d');
	}

	public function sameDate(?DateTimeImmutable $left, ?DateTimeImmutable $right): bool {
		return $this->format($left) === $this->format($right);
	}

	private function parseDate(mixed $value): DateTimeImmutable {
		if (!is_string($value) || preg_match('/^\d{4}-\d{2}-\d{2}$/D', $value) !== 1) {
			throw new ValidationException('A target date must be a valid date.');
		}

		$date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, $this->clock->userTimeZone());
		$errors = DateTimeImmutable::getLastErrors();
		if ($date === false || ($errors !== false && ($errors['warning_count'] !== 0 || $errors['error_count'] !== 0)) || $date->format('Y-m-d') !== $value) {
			throw new ValidationException('A target date must be a valid date.');
		}

		return $date;
	}

	private function normalize(string $referenceType, DateTimeImmutable $date): DateTimeImmutable {
		return match ($referenceType) {
			'day' => $date,
			'week' => $this->weekStart($date),
			'month' => $this->monthStart($date),
			default => throw new ValidationException('Invalid time reference.'),
		};
	}
}
