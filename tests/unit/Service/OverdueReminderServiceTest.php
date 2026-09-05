<?php

declare(strict_types=1);

namespace Service;

use DateTimeImmutable;
use DateTimeZone;
use OCA\Taskbook\Db\EntryMapper;
use OCA\Taskbook\Service\OverdueReminderService;
use OCA\Taskbook\Service\OverdueService;
use OCA\Taskbook\Service\SettingsService;
use OCP\IDateTimeZone;
use OCP\Notification\IManager;
use OCP\Notification\INotification;
use PHPUnit\Framework\TestCase;

final class OverdueReminderServiceTest extends TestCase {
	public function testSendsCountAndRecordsTheSuccessfulLocalDate(): void {
		$entries = $this->createMock(EntryMapper::class);
		$overdue = $this->createMock(OverdueService::class);
		$overdue->expects(self::once())->method('countForUser')->with('alice', self::callback(static fn (DateTimeImmutable $today): bool => $today->format('Y-m-d H:i e') === '2026-09-07 00:00 Europe/Berlin'))->willReturn(4);
		$settings = $this->settings(['overdueReminderEnabled' => true, 'overdueReminderTime' => '08:00', 'overdueReminderDays' => [1]], null);
		$settings->expects(self::once())->method('recordReminderLocalDate')->with('alice', '2026-09-07');
		$notification = $this->notification();
		$notification->expects(self::once())->method('setSubject')->with('overdue_reminder', ['count' => 4])->willReturnSelf();
		$manager = $this->createMock(IManager::class);
		$manager->method('createNotification')->willReturn($notification);
		$manager->expects(self::once())->method('notify')->with($notification);

		$this->service($entries, $overdue, $settings, $manager, new DateTimeZone('Europe/Berlin'))
			->processUser('alice', new DateTimeImmutable('2026-09-07T06:15:00Z'));
	}

	public function testDoesNotSendWhenTheOverdueCountIsZero(): void {
		$overdue = $this->createMock(OverdueService::class);
		$overdue->method('countForUser')->willReturn(0);
		$settings = $this->settings(['overdueReminderEnabled' => true, 'overdueReminderTime' => '08:00', 'overdueReminderDays' => [1]], null);
		$settings->expects(self::never())->method('recordReminderLocalDate');
		$manager = $this->createMock(IManager::class);
		$manager->expects(self::never())->method('createNotification');

		$this->service($this->createMock(EntryMapper::class), $overdue, $settings, $manager)
			->processUser('alice', new DateTimeImmutable('2026-09-07T08:15:00Z'));
	}

	public function testDisabledUnselectedBeforeTimeAndDuplicateChecksDoNotCountOrNotify(): void {
		$cases = [
			[['overdueReminderEnabled' => false, 'overdueReminderTime' => '08:00', 'overdueReminderDays' => [1]], null, '2026-09-07T08:15:00Z'],
			[['overdueReminderEnabled' => true, 'overdueReminderTime' => '08:00', 'overdueReminderDays' => [2]], null, '2026-09-07T08:15:00Z'],
			[['overdueReminderEnabled' => true, 'overdueReminderTime' => '08:00', 'overdueReminderDays' => [1]], null, '2026-09-07T07:59:00Z'],
			[['overdueReminderEnabled' => true, 'overdueReminderTime' => '08:00', 'overdueReminderDays' => [1]], '2026-09-07', '2026-09-07T08:15:00Z'],
		];

		foreach ($cases as [$preferences, $lastDate, $now]) {
			$overdue = $this->createMock(OverdueService::class);
			$overdue->expects(self::never())->method('countForUser');
			$manager = $this->createMock(IManager::class);
			$manager->expects(self::never())->method('createNotification');
			$this->service($this->createMock(EntryMapper::class), $overdue, $this->settings($preferences, $lastDate), $manager)
				->processUser('alice', new DateTimeImmutable($now));
		}
	}

	public function testProcessesOnlyPotentiallyOverdueOwners(): void {
		$entries = $this->createMock(EntryMapper::class);
		$entries->expects(self::once())->method('findPotentiallyOverdueUserIds')->willReturn(['alice']);
		$overdue = $this->createMock(OverdueService::class);
		$overdue->expects(self::once())->method('countForUser')->with('alice', self::anything())->willReturn(1);
		$settings = $this->settings(['overdueReminderEnabled' => true, 'overdueReminderTime' => '08:00', 'overdueReminderDays' => [1]], null);
		$manager = $this->createMock(IManager::class);
		$manager->method('createNotification')->willReturn($this->notification());
		$manager->expects(self::once())->method('notify');

		$this->service($entries, $overdue, $settings, $manager)->process(new DateTimeImmutable('2026-09-07T08:15:00Z'));
	}

	public function testSendsAgainOnTheNextSelectedLocalDay(): void {
		$lastDate = null;
		$settings = $this->createMock(SettingsService::class);
		$settings->method('reminderSettings')->willReturn(['overdueReminderEnabled' => true, 'overdueReminderTime' => '08:00', 'overdueReminderDays' => [1, 3]]);
		$settings->method('lastReminderLocalDate')->willReturnCallback(static function () use (&$lastDate): ?string {
			return $lastDate;
		});
		$settings->method('recordReminderLocalDate')->willReturnCallback(static function (string $uid, string $date) use (&$lastDate): void {
			$lastDate = $date;
		});
		$overdue = $this->createMock(OverdueService::class);
		$overdue->expects(self::exactly(2))->method('countForUser')->willReturn(1);
		$manager = $this->createMock(IManager::class);
		$manager->expects(self::exactly(2))->method('createNotification')->willReturnCallback(fn (): INotification => $this->notification());
		$manager->expects(self::exactly(2))->method('notify');
		$service = $this->service($this->createMock(EntryMapper::class), $overdue, $settings, $manager);

		$service->processUser('alice', new DateTimeImmutable('2026-09-07T08:15:00Z'));
		$service->processUser('alice', new DateTimeImmutable('2026-09-08T08:15:00Z'));
		$service->processUser('alice', new DateTimeImmutable('2026-09-09T08:15:00Z'));

		self::assertSame('2026-09-09', $lastDate);
	}

	public function testUsesTheUserTimezoneAcrossTheDstFallbackAndDeduplicatesByLocalDate(): void {
		$overdue = $this->createMock(OverdueService::class);
		$overdue->expects(self::once())->method('countForUser')->with('alice', self::callback(static fn (DateTimeImmutable $today): bool => $today->format('Y-m-d e') === '2026-10-25 Europe/Berlin'))->willReturn(1);
		$lastDate = null;
		$settings = $this->createMock(SettingsService::class);
		$settings->method('reminderSettings')->willReturn(['overdueReminderEnabled' => true, 'overdueReminderTime' => '02:15', 'overdueReminderDays' => [7]]);
		$settings->method('lastReminderLocalDate')->willReturnCallback(static function () use (&$lastDate): ?string {
			return $lastDate;
		});
		$settings->method('recordReminderLocalDate')->willReturnCallback(static function (string $uid, string $date) use (&$lastDate): void {
			$lastDate = $date;
		});
		$manager = $this->createMock(IManager::class);
		$manager->method('createNotification')->willReturn($this->notification());
		$manager->expects(self::once())->method('notify');
		$service = $this->service($this->createMock(EntryMapper::class), $overdue, $settings, $manager, new DateTimeZone('Europe/Berlin'));

		$service->processUser('alice', new DateTimeImmutable('2026-10-25T00:30:00Z'));
		$service->processUser('alice', new DateTimeImmutable('2026-10-25T01:30:00Z'));
	}

	/** @param array{overdueReminderEnabled: bool, overdueReminderTime: string, overdueReminderDays: list<int>} $preferences */
	private function settings(array $preferences, ?string $lastDate): SettingsService {
		$settings = $this->createMock(SettingsService::class);
		$settings->method('reminderSettings')->willReturn($preferences);
		$settings->method('lastReminderLocalDate')->willReturn($lastDate);
		return $settings;
	}

	private function notification(): INotification {
		$notification = $this->createMock(INotification::class);
		$notification->method('setApp')->willReturnSelf();
		$notification->method('setUser')->willReturnSelf();
		$notification->method('setDateTime')->willReturnSelf();
		$notification->method('setObject')->willReturnSelf();
		$notification->method('setSubject')->willReturnSelf();
		return $notification;
	}

	private function service(
		EntryMapper $entries,
		OverdueService $overdue,
		SettingsService $settings,
		IManager $manager,
		DateTimeZone $timezone = new DateTimeZone('UTC'),
	): OverdueReminderService {
		$dateTimeZone = $this->createMock(IDateTimeZone::class);
		$dateTimeZone->method('getTimeZone')->willReturn($timezone);
		return new OverdueReminderService($entries, $overdue, $settings, $dateTimeZone, $manager);
	}
}
