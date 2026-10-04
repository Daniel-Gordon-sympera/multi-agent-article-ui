"""Fan-out leg naming (contract §4.5) and the API bodies the legs carry."""

import uuid

from scout_bff.batches.models import BatchInput
from scout_bff.batches.naming import (
    batch_reference_prefix,
    client_reference,
    parse_client_reference,
    slug,
)
from scout_bff.batches.service import api_job_body, plan_legs


def test_slug_folds_case_punctuation_and_accents():
    assert slug("Wholesale Trade") == "wholesale-trade"
    assert slug("  Finance & Insurance  ") == "finance-insurance"
    assert slug("Café Culture") == "cafe-culture"
    assert slug("---") == "x"
    assert len(slug("a" * 200)) == 80


def test_client_reference_shapes():
    batch_id = str(uuid.uuid4())
    assert client_reference(batch_id, "Construction") == f"ui:{batch_id}:construction"
    assert client_reference(batch_id, None) == f"ui:{batch_id}:0"
    assert client_reference(batch_id, "Retail Trade", "Re Run") == (
        f"ui:{batch_id}:retail-trade:re-run"
    )
    assert batch_reference_prefix(batch_id) == f"ui:{batch_id}:"
    assert parse_client_reference(f"ui:{batch_id}:retail-trade:re-run") == (
        batch_id,
        "retail-trade",
    )
    assert parse_client_reference("scout-7-2026-10-04") is None
    assert parse_client_reference(None) is None


def test_plan_legs_one_per_industry_with_overrides_only():
    body = BatchInput(
        kind="location_industry",
        county="Orange County",
        state_code="Florida",
        location="Orlando, FL",
        industries=["Construction", "Manufacturing", "Construction"],
        settings={"sites": 5, "days": None},
    )
    batch_id = uuid.uuid4()
    legs = plan_legs(body, batch_id, None)
    assert [leg.position for leg in legs] == [1, 2]
    assert [leg.industry for leg in legs] == ["Construction", "Manufacturing"]
    assert legs[0].client_reference == f"ui:{batch_id}:construction"
    assert legs[0].body == {
        "kind": "location_industry",
        "county": "Orange",
        "state": "FL",
        "client_reference": f"ui:{batch_id}:construction",
        "settings": {"sites": 5},
        "location": "Orlando, FL",
        "industry": "Construction",
    }


def test_url_and_seed_kinds_make_a_single_leg():
    url_body = BatchInput(
        kind="url", county="Orange", state_code="FL", url="orlandomagazine.com"
    )
    batch_id = uuid.uuid4()
    (leg,) = plan_legs(url_body, batch_id, None)
    assert leg.client_reference == f"ui:{batch_id}:0"
    assert leg.body["url"] == "https://orlandomagazine.com/"
    assert "settings" not in leg.body

    seed_body = BatchInput(kind="seeds", county="Orange", state_code="FL")
    seeds = [{"title": "Orlando Magazine", "url": "https://orlandomagazine.com/"}]
    (leg,) = plan_legs(seed_body, batch_id, seeds)
    assert leg.body["seeds"] == seeds
    assert leg.body["location"] if "location" in leg.body else True


def test_default_location_when_the_form_gave_none():
    body = BatchInput(
        kind="location_industry", county="Harris", state_code="TX", industries=["Mfg"]
    )
    assert (
        api_job_body(body, "Mfg", None, "ui:x:mfg")["location"]
        == "Harris County, Texas"
    )
