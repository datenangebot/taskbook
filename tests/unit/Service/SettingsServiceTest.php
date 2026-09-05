<?php

declare(strict_types=1);

namespace Service;

use OCA\Taskbook\AppInfo\Application;
use OCA\Taskbook\Exception\ValidationException;
use OCA\Taskbook\Service\ContextService;
use OCA\Taskbook\Service\SettingsService;
use OCP\IConfig;
use PHPUnit\Framework\TestCase;

final class SettingsServiceTest extends TestCase {
	public function testReturnsReminderDefaultsWithoutStoredValues(): void {
		$service = new SettingsService($this->contexts(), $this->config());

		self::assertSame([
			'defaultContextId' => 1,
			'contexts' => [],
			'overdueReminderEnabled' => true,
			'overdueReminderTime' => '08:00',
			'overdueReminderDays' => [1, 2, 3, 4, 5, 6, 7],
		], $service->get('alice'));
	}

	public function testPersistsNormalizedReminderSettingsForOnlyTheRequestedUser(): void {
		$values = [];
		$service = new SettingsService($this->contexts(), $this->config($values));

		$settings = $service->updateReminders('alice', false, '17:45', [7, 2, 2, 1]);

		self::assertFalse($settings['overdueReminderEnabled']);
		self::assertSame('17:45', $settings['overdueReminderTime']);
		self::assertSame([1, 2, 7], $settings['overdueReminderDays']);
		self::assertSame('1', $service->reminderSettings('bob')['overdueReminderEnabled'] ? '1' : '0');
		self::assertSame([
			'overdue_reminder_enabled' => '0',
			'overdue_reminder_time' => '17:45',
			'overdue_reminder_days' => '1,2,7',
		], $values['alice']);
		self::assertArrayNotHasKey('bob', $values);
	}

	public function testRejectsInvalidTimeAndWeekdays(): void {
		$service = new SettingsService($this->contexts(), $this->config());

		foreach ([['25:00', [1]], ['8:00', [1]], ['08:00', [0]], ['08:00', [8]], ['08:00', []]] as [$time, $days]) {
			try {
				$service->updateReminders('alice', true, $time, $days);
				self::fail('Invalid reminder settings were accepted.');
			} catch (ValidationException) {
				self::assertTrue(true);
			}
		}
	}

	public function testRejectsNonBooleanEnabledValue(): void {
		$this->expectException(ValidationException::class);
		(new SettingsService($this->contexts(), $this->config()))->updateReminders('alice', 1, '08:00', [1]);
	}

	private function contexts(): ContextService {
		$contexts = $this->createMock(ContextService::class);
		$contexts->method('settings')->willReturn(['defaultContextId' => 1, 'contexts' => []]);
		return $contexts;
	}

	/** @param array<string, array<string, string>> $values */
	private function config(?array &$values = null): IConfig {
		$values ??= [];
		$config = $this->createMock(IConfig::class);
		$config->method('getUserValue')->willReturnCallback(static function (string $uid, string $app, string $key, string $default = '') use (&$values): string {
			self::assertSame(Application::APP_ID, $app);
			return $values[$uid][$key] ?? $default;
		});
		$config->method('setUserValue')->willReturnCallback(static function (string $uid, string $app, string $key, string $value) use (&$values): void {
			self::assertSame(Application::APP_ID, $app);
			$values[$uid][$key] = $value;
		});
		return $config;
	}
}
