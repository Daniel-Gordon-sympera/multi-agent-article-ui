"""Domain extraction, URL validation and state/county normalisation of the sources package."""

import pytest

from scout_bff.sources.domains import (
    InvalidUrl,
    domain_of,
    normalise_domain,
    normalise_url,
)
from scout_bff.sources.states import normalise_county, normalise_state_code, state_name


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("https://www.orlandomagazine.com/business/", "orlandomagazine.com"),
        ("http://OrlandoSentinel.com", "orlandosentinel.com"),
        ("bizjournals.com/orlando", "bizjournals.com"),
        ("www.growthspotter.com", "growthspotter.com"),
        ("https://news.example.co.uk:8443/path?x=1", "news.example.co.uk"),
    ],
)
def test_domain_of_strips_scheme_www_path_and_port(value, expected):
    assert domain_of(value) == expected
    assert normalise_domain(value) == expected


def test_normalise_url_adds_https_and_keeps_the_path():
    assert normalise_url("orlandomagazine.com") == "https://orlandomagazine.com/"
    assert normalise_url("HTTPS://Www.Example.com/News?a=1#top") == (
        "https://www.example.com/News?a=1"
    )


@pytest.mark.parametrize(
    "value", ["", "   ", "ftp://example.com", "https://", "mailto:x@y.z"]
)
def test_invalid_urls_raise(value):
    with pytest.raises(InvalidUrl):
        normalise_url(value)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("FL", "FL"),
        ("fl", "FL"),
        ("Florida", "FL"),
        (" florida ", "FL"),
        ("District of Columbia", "DC"),
        ("Puerto Rico", "PR"),
        ("Narnia", None),
        ("", None),
        (None, None),
    ],
)
def test_state_normalisation(value, expected):
    assert normalise_state_code(value) == expected


def test_state_name_round_trip():
    assert state_name("FL") == "Florida"
    assert state_name("fl") == "Florida"
    assert state_name("ZZ") == "ZZ"


def test_normalise_county_drops_the_suffix_only():
    assert normalise_county("Orange County") == "Orange"
    assert normalise_county("  orange   county ") == "orange"
    assert normalise_county("Jefferson") == "Jefferson"
    assert normalise_county("County Line") == "County Line"
