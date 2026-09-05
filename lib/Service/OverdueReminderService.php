<?php

declare(strict_types=1);

namespace OCA\Taskbook\Service;

use DateTime;
use DateTimeImmutable;
use OCA\Taskbook\AppInfo\Application;
use OCA\Taskbook\Db\EntryMapper;
use OCP\IDateTimeZone;
use OCP\Notification\IManager;

/** Evaluates and delivers one generic overdue reminder per user-local day. */
class OverdueReminderService {
	/** @psalm-suppress PossiblyUnusedMethod Instantiated by Nextcloud dependency injection. */
	public function __construct(
		private EntryMapper $entryMapper,
		private OverdueService $overdueService,
		private SettingsService $settingsService,
		private IDateTimeZone $dateTimeZone,
		private IManager $notificationManager,
	) {
	}

	public function process(DateTimeImmutable $now): void {
		foreach ($this->entryMapper->findPotentiallyOverdueUserIds() as $uid) {
			$this->processUser($uid, $now);
		}
	}

	public function processUser(string $uid, DateTimeImmutable $now): void {
		/** @psalm-suppress TooManyArguments Nextcloud 32 added explicit user lookup. */
		$timezone = $this->dateTimeZone->getTimeZone($now->getTimestamp(), $uid);
		$localNow = $now->setTimezone($timezone);
		$localDate = $localNow->format('Y-m-d');
		$settings = $this->settingsService->reminderSettings($uid);
		if (!$settings['overdueReminderEnabled']
			|| !in_array((int)$localNow->format('N'), $settings['overdueReminderDays'], true)
			|| $localNow->format('H:i') < $settings['overdueReminderTime']
			|| $this->settingsService->lastReminderLocalDate($uid) === $localDate) {
			return;
		}

		$today = $localNow->setTime(0, 0, 0);
		$count = $this->overdueService->countForUser($uid, $today);
		if ($count === 0) {
			return;
		}

		$notification = $this->notificationManager->createNotification();
		$notification->setApp(Application::APP_ID)
			->setUser($uid)
			->setDateTime(DateTime::createFromImmutable($now))
			->setObject('overdue_reminder', $localDate)
			->setSubject('overdue_reminder', ['count' => $count]);
		$this->notificationManager->notify($notification);
		$this->settingsService->recordReminderLocalDate($uid, $localDate);
	}
}
