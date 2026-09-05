<?php

declare(strict_types=1);

namespace OCA\Taskbook\Service;

use OCA\Taskbook\AppInfo\Application;
use OCA\Taskbook\Exception\ValidationException;
use OCA\Taskbook\ResponseDefinitions;

/** @psalm-import-type TaskbookSettings from ResponseDefinitions */
class SettingsService {
	private const REMINDER_ENABLED_KEY = 'overdue_reminder_enabled';
	private const REMINDER_TIME_KEY = 'overdue_reminder_time';
	private const REMINDER_DAYS_KEY = 'overdue_reminder_days';
	private const LAST_REMINDER_DATE_KEY = 'last_overdue_reminder_local_date';
	private const DEFAULT_TIME = '08:00';
	/** @var list<int> */
	private const DEFAULT_DAYS = [1, 2, 3, 4, 5, 6, 7];

	/** @psalm-suppress PossiblyUnusedMethod Instantiated by Nextcloud dependency injection. */
	public function __construct(
		private ContextService $contextService,
		private UserConfigService $userConfig,
	) {
	}

	/** @return TaskbookSettings */
	public function get(string $uid): array {
		return [
			...$this->contextService->settings($uid),
			...$this->reminderSettings($uid),
		];
	}

	/** @return TaskbookSettings */
	public function setDefaultContext(string $uid, mixed $contextId): array {
		return [
			...$this->contextService->setDefault($uid, $contextId),
			...$this->reminderSettings($uid),
		];
	}

	/** @return TaskbookSettings */
	public function updateReminders(string $uid, mixed $enabled, mixed $time, mixed $days): array {
		if (!is_bool($enabled)) {
			throw new ValidationException('Reminder enabled must be a boolean.');
		}
		$validatedTime = $this->validateTime($time);
		$validatedDays = $this->validateDays($days);
		$this->userConfig->setBool($uid, Application::APP_ID, self::REMINDER_ENABLED_KEY, $enabled);
		$this->userConfig->setString($uid, Application::APP_ID, self::REMINDER_TIME_KEY, $validatedTime);
		$this->userConfig->setDays($uid, Application::APP_ID, self::REMINDER_DAYS_KEY, $validatedDays);
		return $this->get($uid);
	}

	/** @return array{overdueReminderEnabled: bool, overdueReminderTime: string, overdueReminderDays: list<int>} */
	public function reminderSettings(string $uid): array {
		return [
			'overdueReminderEnabled' => $this->userConfig->getBool($uid, Application::APP_ID, self::REMINDER_ENABLED_KEY, true),
			'overdueReminderTime' => $this->storedTime($uid),
			'overdueReminderDays' => $this->storedDays($uid),
		];
	}

	public function lastReminderLocalDate(string $uid): ?string {
		$value = $this->userConfig->getString($uid, Application::APP_ID, self::LAST_REMINDER_DATE_KEY, '');
		return preg_match('/^\d{4}-\d{2}-\d{2}$/D', $value) === 1 ? $value : null;
	}

	public function recordReminderLocalDate(string $uid, string $localDate): void {
		if (preg_match('/^\d{4}-\d{2}-\d{2}$/D', $localDate) !== 1) {
			throw new \InvalidArgumentException('Invalid local reminder date.');
		}
		$this->userConfig->setString($uid, Application::APP_ID, self::LAST_REMINDER_DATE_KEY, $localDate);
	}

	private function storedTime(string $uid): string {
		$value = $this->userConfig->getString($uid, Application::APP_ID, self::REMINDER_TIME_KEY, self::DEFAULT_TIME);
		try {
			return $this->validateTime($value);
		} catch (ValidationException) {
			return self::DEFAULT_TIME;
		}
	}

	/** @return list<int> */
	private function storedDays(string $uid): array {
		$value = $this->userConfig->getDays($uid, Application::APP_ID, self::REMINDER_DAYS_KEY, self::DEFAULT_DAYS);
		try {
			return $this->validateDays($value);
		} catch (ValidationException) {
			return self::DEFAULT_DAYS;
		}
	}

	private function validateTime(mixed $time): string {
		if (!is_string($time) || preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/D', $time) !== 1) {
			throw new ValidationException('Reminder time must use HH:MM in 24-hour format.');
		}
		return $time;
	}

	/** @return list<int> */
	private function validateDays(mixed $days): array {
		if (!is_array($days) || $days === []) {
			throw new ValidationException('Select at least one reminder day.');
		}
		$normalized = [];
		foreach ($days as $day) {
			if (!is_int($day) || $day < 1 || $day > 7) {
				throw new ValidationException('Reminder days must be ISO weekday numbers from 1 to 7.');
			}
			$normalized[$day] = $day;
		}
		ksort($normalized);
		return array_values($normalized);
	}
}
