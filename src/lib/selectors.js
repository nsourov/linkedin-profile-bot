export default {
  buttons: {
    seemore: {
      about: ".pv-profile-section.pv-about-section .lt-line-clamp__more",
      experience: "#experience-section .pv-profile-section__see-more-inline",
      education:
        ".pv-profile-section.education-section button.pv-profile-section__see-more-inline",
      skill:
        '.pv-skill-categories-section [data-control-name="skill_details"]',
    },
  },
  data: {
    profile: {
      card: ".pv-top-card",
      fullName: ".pv-top-card--list li:first-child",
      title: "h2",
      description: ".pv-about__summary-text",
      location:
        ".pv-top-card--list.pv-top-card--list-bullet.mt1 li:first-child",
      photo: {
        elem1: ".pv-top-card__photo",
        elem2: ".profile-photo-edit__preview",
      },
    },
    experience: {
      card: "#experience-section ul > .ember-view",
      title: "h3",
      employmentType: "span.pv-entity__secondary-title",
      company: ".pv-entity__secondary-title",
      description: ".pv-entity__secondary-title",
      dateRange: ".pv-entity__date-range span:nth-child(2)",
      location: ".pv-entity__location span:nth-child(2)",
    },
    education: {
      card: "#education-section ul > .ember-view",
      schoolName: "h3.pv-entity__school-name",
      degreeName: ".pv-entity__degree-name .pv-entity__comma-item",
      fieldOfStudy: ".pv-entity__fos .pv-entity__comma-item",
      dateRange: ".pv-entity__dates time",
    },
    skill: {
      card: ".pv-skill-categories-section ol > .ember-view",
      name: ".pv-skill-category-entity__name-text",
      endorsement: ".pv-skill-category-entity__endorsement-count",
      description: ".pv-entity__description",
      dateRange: ".pv-entity__date-range span:nth-child(2)",
    },
  },
};
