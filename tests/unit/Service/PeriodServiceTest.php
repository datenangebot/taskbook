<?php

declare(strict_types=1);

namespace Service;

use DateTimeZone;
use OCA\Taskbook\Exception\ValidationException;
use OCA\Taskbook\Service\Clock;
use OCA\Taskbook\Service\PeriodService;
use PHPUnit\Framework\TestCase;

final class PeriodServiceTest extends TestCase {
	private PeriodService $service;

	protected function setUp(): void {
		$clock = $this->createMock(Clock::class);
		$clock->method('userTimeZone')->willReturn(new DateTimeZone('Europe/Berlin'));
		$this->service = new PeriodService($clock);
	}

	public function testWeekAndMonthTargetsAreNormalizedWithoutUtcConversion(): void {
		$this->assertSame('2026-08-24', $this->service->format($this->service->validate('week', '2026-08-28')['targetDate']));
		$this->assertSame('2026-08-01', $this->service->format($this->service->validate('month', '2026-08-28')['targetDate']));
		$this->assertSame('2026-08-28', $this->service->format($this->service->validate('day', '2026-08-28')['targetDate']));
	}

	public function testNoneRequiresNoDate(): void {
		$this->assertNull($this->service->validate('none', null)['targetDate']);
		$this->expectException(ValidationException::class);
		$this->service->validate('none', '2026-08-28');
	}

	public function testInvalidDateIsRejected(): void {
		$this->expectException(ValidationException::class);
		$this->service->validate('day', '2026-02-30');
	}
}
