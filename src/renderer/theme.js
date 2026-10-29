'use strict';
{
	const bridge = window.api || window.splash;
	amsTheme.apply(bridge.theme, document.documentElement);
	bridge.onTheme?.((theme) => amsTheme.apply(theme, document.documentElement));
}