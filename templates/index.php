<?php

declare(strict_types=1);

use OCP\Util;

Util::addScript(OCA\Taskbook\AppInfo\Application::APP_ID, OCA\Taskbook\AppInfo\Application::APP_ID . '-main');
Util::addStyle(OCA\Taskbook\AppInfo\Application::APP_ID, OCA\Taskbook\AppInfo\Application::APP_ID . '-main');

?>

<div id="taskbook"></div>
